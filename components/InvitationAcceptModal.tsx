import React, { useState, useEffect } from 'react';
import { CollaborationService } from '../services/collaborationService';
import { XIcon, CheckCircleIcon, ExclamationTriangleIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface InvitationAcceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (projectId: string) => void;
}

const InvitationAcceptModal: React.FC<InvitationAcceptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [token, setToken] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // URLパラメータから招待トークンを取得
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    if (inviteToken) {
      setToken(inviteToken);
    }
  }, []);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsAccepting(true);
    setError(null);

    try {
      const result = await CollaborationService.acceptInvitation(token);
      if (result.success && result.projectId) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess(result.projectId!);
          onClose();
        }, 2000);
      } else {
        setError(result.error || '招待の受諾に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待の受諾に失敗しました');
    } finally {
      setIsAccepting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <header className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">プロジェクト招待</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6">
          {success ? (
            <div className="text-center">
              <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-green-800 mb-2">招待を受諾しました！</h4>
              <p className="text-slate-600">プロジェクトにリダイレクトしています...</p>
            </div>
          ) : (
            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-slate-700 mb-1">
                  招待トークン
                </label>
                <input
                  type="text"
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  placeholder="招待トークンを入力してください"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  招待メールに記載されているトークンを入力してください
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isAccepting || !token.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-400 flex items-center justify-center"
                >
                  {isAccepting ? <LoadingSpinner size="sm" color="border-white" /> : '招待を受諾'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvitationAcceptModal;