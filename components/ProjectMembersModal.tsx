import React, { useState, useEffect } from 'react';
import { CollaborationService, ProjectMember, ProjectInvitation } from '../services/collaborationService';
import { XIcon, PlusIcon, TrashIcon, UserIcon, MailIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface ProjectMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  userRole: string;
}

const ProjectMembersModal: React.FC<ProjectMembersModalProps> = ({
  isOpen,
  onClose,
  projectId,
  userRole,
}) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [isInviting, setIsInviting] = useState(false);

  const canManageMembers = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, projectId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [membersData, invitationsData] = await Promise.all([
        CollaborationService.getProjectMembers(projectId),
        canManageMembers ? CollaborationService.getProjectInvitations(projectId) : Promise.resolve([])
      ]);
      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      await CollaborationService.inviteToProject(projectId, inviteEmail, inviteRole);
      setInviteEmail('');
      setShowInviteForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待の送信に失敗しました');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    try {
      await CollaborationService.updateMemberRole(projectId, userId, newRole);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '役割の変更に失敗しました');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('このメンバーを削除しますか？')) return;

    try {
      await CollaborationService.removeMember(projectId, userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバーの削除に失敗しました');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await CollaborationService.cancelInvitation(invitationId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待の取り消しに失敗しました');
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'owner': return 'オーナー';
      case 'admin': return '管理者';
      case 'editor': return '編集者';
      case 'viewer': return '閲覧者';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-red-100 text-red-800';
      case 'editor': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">プロジェクトメンバー</h3>
          <div className="flex items-center gap-3">
            {canManageMembers && (
              <button
                onClick={() => setShowInviteForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <PlusIcon className="w-5 h-5" />
                メンバーを招待
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-grow p-6 overflow-y-auto">
          {error && <ErrorMessage message={error} />}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="読み込み中..." />
            </div>
          ) : (
            <div className="space-y-6">
              {/* 招待フォーム */}
              {showInviteForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3">新しいメンバーを招待</h4>
                  <form onSubmit={handleInvite} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        メールアドレス
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                        placeholder="example@email.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        役割
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                      >
                        <option value="viewer">閲覧者 - プロジェクトを閲覧のみ</option>
                        <option value="editor">編集者 - プロジェクトを編集可能</option>
                        <option value="admin">管理者 - メンバー管理も可能</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isInviting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-400"
                      >
                        {isInviting ? <LoadingSpinner size="sm" color="border-white" /> : '招待を送信'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInviteForm(false)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300"
                      >
                        キャンセル
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 現在のメンバー */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center">
                  <UserIcon className="w-5 h-5 mr-2" />
                  現在のメンバー ({members.length})
                </h4>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {member.userEmail?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{member.userEmail}</p>
                          <p className="text-sm text-slate-500">
                            参加日: {new Date(member.joinedAt).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManageMembers && member.role !== 'owner' ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.userId, e.target.value as 'admin' | 'editor' | 'viewer')}
                            className="px-2 py-1 text-sm border border-slate-300 rounded"
                          >
                            <option value="viewer">閲覧者</option>
                            <option value="editor">編集者</option>
                            <option value="admin">管理者</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(member.role)}`}>
                            {getRoleDisplayName(member.role)}
                          </span>
                        )}
                        {canManageMembers && member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(member.userId)}
                            className="p-1 text-red-500 hover:text-red-700 rounded"
                            title="メンバーを削除"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 保留中の招待 */}
              {canManageMembers && invitations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center">
                    <MailIcon className="w-5 h-5 mr-2" />
                    保留中の招待 ({invitations.filter(inv => !inv.acceptedAt).length})
                  </h4>
                  <div className="space-y-2">
                    {invitations
                      .filter(invitation => !invitation.acceptedAt)
                      .map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-800">{invitation.email}</p>
                            <p className="text-sm text-slate-500">
                              役割: {getRoleDisplayName(invitation.role)} | 
                              期限: {new Date(invitation.expiresAt).toLocaleDateString('ja-JP')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="p-1 text-red-500 hover:text-red-700 rounded"
                            title="招待を取り消し"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectMembersModal;