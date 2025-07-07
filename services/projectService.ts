import { supabase } from '../lib/supabase';
import { ProjectTask, GanttItem } from '../types';

export interface ProjectData {
  id: string;
  title: string;
  goal: string;
  targetDate: string;
  tasks: ProjectTask[];
  ganttData?: GanttItem[] | null;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  isPublic: boolean;
  lastModifiedBy?: string;
  userRole?: string; // ユーザーの権限
}

export class ProjectService {
  // プロジェクト一覧を取得（権限情報も含む）
  static async getProjects(): Promise<ProjectData[]> {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members!inner(role)
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`プロジェクトの取得に失敗しました: ${error.message}`);
    }

    return data.map(project => ({
      id: project.id,
      title: project.title,
      goal: project.goal,
      targetDate: project.target_date,
      tasks: project.tasks_data || [],
      ganttData: project.gantt_data,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      ownerId: project.owner_id,
      isPublic: project.is_public,
      lastModifiedBy: project.last_modified_by,
      userRole: project.project_members[0]?.role,
    }));
  }

  // プロジェクトを作成
  static async createProject(
    title: string,
    goal: string,
    targetDate: string,
    tasks: ProjectTask[] = [],
    ganttData?: GanttItem[] | null
  ): Promise<ProjectData> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
        user_id: user.id, // 後方互換性のため
        title,
        goal,
        target_date: targetDate,
        tasks_data: tasks,
        gantt_data: ganttData,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`プロジェクトの作成に失敗しました: ${error.message}`);
    }

    return {
      id: data.id,
      title: data.title,
      goal: data.goal,
      targetDate: data.target_date,
      tasks: data.tasks_data || [],
      ganttData: data.gantt_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      ownerId: data.owner_id,
      isPublic: data.is_public,
      lastModifiedBy: data.last_modified_by,
      userRole: 'owner',
    };
  }

  // プロジェクトを更新
  static async updateProject(
    id: string,
    updates: {
      title?: string;
      goal?: string;
      targetDate?: string;
      tasks?: ProjectTask[];
      ganttData?: GanttItem[] | null;
      isPublic?: boolean;
    }
  ): Promise<ProjectData> {
    const updateData: any = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.goal !== undefined) updateData.goal = updates.goal;
    if (updates.targetDate !== undefined) updateData.target_date = updates.targetDate;
    if (updates.tasks !== undefined) updateData.tasks_data = updates.tasks;
    if (updates.ganttData !== undefined) updateData.gantt_data = updates.ganttData;
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        project_members!inner(role)
      `)
      .single();

    if (error) {
      throw new Error(`プロジェクトの更新に失敗しました: ${error.message}`);
    }

    return {
      id: data.id,
      title: data.title,
      goal: data.goal,
      targetDate: data.target_date,
      tasks: data.tasks_data || [],
      ganttData: data.gantt_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      ownerId: data.owner_id,
      isPublic: data.is_public,
      lastModifiedBy: data.last_modified_by,
      userRole: data.project_members[0]?.role,
    };
  }

  // プロジェクトを削除
  static async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`プロジェクトの削除に失敗しました: ${error.message}`);
    }
  }

  // 特定のプロジェクトを取得
  static async getProject(id: string): Promise<ProjectData> {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members!inner(role)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`プロジェクトの取得に失敗しました: ${error.message}`);
    }

    return {
      id: data.id,
      title: data.title,
      goal: data.goal,
      targetDate: data.target_date,
      tasks: data.tasks_data || [],
      ganttData: data.gantt_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      ownerId: data.owner_id,
      isPublic: data.is_public,
      lastModifiedBy: data.last_modified_by,
      userRole: data.project_members[0]?.role,
    };
  }

  // プロジェクトの公開設定を切り替え
  static async toggleProjectVisibility(id: string): Promise<boolean> {
    const project = await this.getProject(id);
    const newVisibility = !project.isPublic;
    
    await this.updateProject(id, { isPublic: newVisibility });
    return newVisibility;
  }
}