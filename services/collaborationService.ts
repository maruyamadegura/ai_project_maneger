import { supabase } from '../lib/supabase';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  invitedBy?: string;
  joinedAt: string;
  userEmail?: string;
  userName?: string;
}

export interface ProjectInvitation {
  id: string;
  projectId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  invitedBy: string;
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  projectId: string;
  userId?: string;
  action: string;
  details?: any;
  createdAt: string;
  userEmail?: string;
}

export class CollaborationService {
  // プロジェクトメンバー一覧を取得
  static async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        users:user_id (email)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`メンバー一覧の取得に失敗しました: ${error.message}`);
    }

    return data.map(member => ({
      id: member.id,
      projectId: member.project_id,
      userId: member.user_id,
      role: member.role,
      invitedBy: member.invited_by,
      joinedAt: member.joined_at,
      userEmail: (member.users as any)?.email,
    }));
  }

  // プロジェクトに招待を送信
  static async inviteToProject(
    projectId: string,
    email: string,
    role: 'admin' | 'editor' | 'viewer'
  ): Promise<ProjectInvitation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    const { data, error } = await supabase
      .from('project_invitations')
      .insert({
        project_id: projectId,
        email,
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('このメールアドレスは既に招待されています');
      }
      throw new Error(`招待の送信に失敗しました: ${error.message}`);
    }

    return {
      id: data.id,
      projectId: data.project_id,
      email: data.email,
      role: data.role,
      invitedBy: data.invited_by,
      token: data.token,
      expiresAt: data.expires_at,
      acceptedAt: data.accepted_at,
      createdAt: data.created_at,
    };
  }

  // 招待一覧を取得
  static async getProjectInvitations(projectId: string): Promise<ProjectInvitation[]> {
    const { data, error } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`招待一覧の取得に失敗しました: ${error.message}`);
    }

    return data.map(invitation => ({
      id: invitation.id,
      projectId: invitation.project_id,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invited_by,
      token: invitation.token,
      expiresAt: invitation.expires_at,
      acceptedAt: invitation.accepted_at,
      createdAt: invitation.created_at,
    }));
  }

  // 招待を受諾
  static async acceptInvitation(token: string): Promise<{ success: boolean; projectId?: string; error?: string }> {
    const { data, error } = await supabase.rpc('accept_project_invitation', {
      invitation_token: token
    });

    if (error) {
      throw new Error(`招待の受諾に失敗しました: ${error.message}`);
    }

    return data;
  }

  // メンバーの役割を変更
  static async updateMemberRole(
    projectId: string,
    userId: string,
    newRole: 'admin' | 'editor' | 'viewer'
  ): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .update({ role: newRole })
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`メンバーの役割変更に失敗しました: ${error.message}`);
    }
  }

  // メンバーを削除
  static async removeMember(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`メンバーの削除に失敗しました: ${error.message}`);
    }
  }

  // 招待を取り消し
  static async cancelInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('project_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      throw new Error(`招待の取り消しに失敗しました: ${error.message}`);
    }
  }

  // 活動ログを取得
  static async getActivityLog(projectId: string, limit: number = 50): Promise<ActivityLogEntry[]> {
    const { data, error } = await supabase
      .from('project_activity_log')
      .select(`
        *,
        users:user_id (email)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`活動ログの取得に失敗しました: ${error.message}`);
    }

    return data.map(log => ({
      id: log.id,
      projectId: log.project_id,
      userId: log.user_id,
      action: log.action,
      details: log.details,
      createdAt: log.created_at,
      userEmail: (log.users as any)?.email,
    }));
  }

  // 現在のユーザーの権限を取得
  static async getUserRole(projectId: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      return null;
    }

    return data.role;
  }

  // リアルタイム更新の購読
  static subscribeToProjectUpdates(
    projectId: string,
    onUpdate: (payload: any) => void
  ) {
    return supabase
      .channel(`project-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        onUpdate
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_members',
          filter: `project_id=eq.${projectId}`,
        },
        onUpdate
      )
      .subscribe();
  }
}