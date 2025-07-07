import React, { useState, useEffect } from 'react';
import { ProjectTask, SubStep, TaskStatus, ExtendedTaskDetails, Attachment, Decision } from '../types';
import { XIcon, PlusIcon, TrashIcon, SaveIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface TaskDetailModalProps {
  task: ProjectTask;
  onClose: () => void;
  onUpdate: (updatedTask: ProjectTask) => void;
  onDelete: (taskId: string) => void;
  onOpenSlideEditor: (slideDeck: any) => void;
  onSubStepUpdate: (subSteps: SubStep[]) => void;
  onSubStepAdd: (title: string, description: string) => void;
  onSubStepDelete: (subStepId: string) => void;
  onSubStepStatusChange: (subStepId: string, status: TaskStatus) => void;
  onAttachmentAdd: (attachment: Omit<Attachment, 'id'>) => void;
  onAttachmentDelete: (attachmentId: string) => void;
  onDecisionAdd: (decision: Omit<Decision, 'id'>) => void;
  onDecisionUpdate: (decisionId: string, updates: Partial<Decision>) => void;
  onDecisionDelete: (decisionId: string) => void;
  onCanvasSizeUpdate: (size: { width: number; height: number }) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  onClose,
  onUpdate,
  onDelete,
  onOpenSlideEditor,
  onSubStepUpdate,
  onSubStepAdd,
  onSubStepDelete,
  onSubStepStatusChange,
  onAttachmentAdd,
  onAttachmentDelete,
  onDecisionAdd,
  onDecisionUpdate,
  onDecisionDelete,
  onCanvasSizeUpdate,
}) => {
  const [editedTask, setEditedTask] = useState<ProjectTask>(task);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'substeps' | 'attachments' | 'decisions'>('details');

  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(editedTask);
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: keyof ProjectTask, value: any) => {
    setEditedTask(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExtendedDetailsChange = (field: keyof ExtendedTaskDetails, value: any) => {
    setEditedTask(prev => ({
      ...prev,
      extendedDetails: {
        ...prev.extendedDetails!,
        [field]: value
      }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">タスク詳細</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              {isSaving ? <LoadingSpinner size="sm" /> : <SaveIcon className="w-4 h-4" />}
              保存
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'details', label: '基本情報' },
                { id: 'substeps', label: 'サブステップ' },
                { id: 'attachments', label: '添付ファイル' },
                { id: 'decisions', label: '決定事項' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    タスク名
                  </label>
                  <input
                    type="text"
                    value={editedTask.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <textarea
                    value={editedTask.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ステータス
                  </label>
                  <select
                    value={editedTask.status || TaskStatus.NOT_STARTED}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={TaskStatus.NOT_STARTED}>未着手</option>
                    <option value={TaskStatus.IN_PROGRESS}>進行中</option>
                    <option value={TaskStatus.COMPLETED}>完了</option>
                    <option value={TaskStatus.BLOCKED}>停滞中</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    期日
                  </label>
                  <input
                    type="date"
                    value={editedTask.extendedDetails?.dueDate || ''}
                    onChange={(e) => handleExtendedDetailsChange('dueDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    担当者
                  </label>
                  <input
                    type="text"
                    value={editedTask.extendedDetails?.responsible || ''}
                    onChange={(e) => handleExtendedDetailsChange('responsible', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メモ
                  </label>
                  <textarea
                    value={editedTask.extendedDetails?.notes || ''}
                    onChange={(e) => handleExtendedDetailsChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {activeTab === 'substeps' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">サブステップ</h3>
                  <button
                    onClick={() => onSubStepAdd('新しいサブステップ', '')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <PlusIcon className="w-4 h-4" />
                    追加
                  </button>
                </div>

                <div className="space-y-3">
                  {editedTask.extendedDetails?.subSteps?.map((subStep) => (
                    <div key={subStep.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{subStep.text}</h4>
                          <p className="text-sm text-gray-600 mt-1">{subStep.notes}</p>
                        </div>
                        <button
                          onClick={() => onSubStepDelete(subStep.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            )}

            {activeTab === 'attachments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">添付ファイル</h3>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          onAttachmentAdd({
                            name: file.name,
                            type: file.type,
                            dataUrl: event.target?.result as string,
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                  >
                    <PlusIcon className="w-4 h-4" />
                    ファイル追加
                  </label>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {editedTask.extendedDetails?.attachments?.map((attachment) => (
                    <div key={attachment.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium truncate">{attachment.name}</span>
                        <button
                          onClick={() => onAttachmentDelete(attachment.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                      {attachment.type.startsWith('image/') && (
                        <img
                          src={attachment.dataUrl}
                          alt={attachment.name}
                          className="w-full h-20 object-cover rounded"
                        />
                      )}
                    </div>
                  )) || []}
                </div>
              </div>
            )}

            {activeTab === 'decisions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">決定事項</h3>
                  <button
                    onClick={() => onDecisionAdd({
                      question: '',
                      status: 'undecided'
                    })}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <PlusIcon className="w-4 h-4" />
                    追加
                  </button>
                </div>

                <div className="space-y-3">
                  {editedTask.extendedDetails?.decisions?.map((decision) => (
                    <div key={decision.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={decision.question}
                            onChange={(e) => onDecisionUpdate(decision.id, { question: e.target.value })}
                            placeholder="決定すべき項目"
                            className="w-full font-medium border-none outline-none bg-transparent"
                          />
                          <div className="mt-2 space-y-2">
                            <select
                              value={decision.status}
                              onChange={(e) => onDecisionUpdate(decision.id, { status: e.target.value as 'decided' | 'undecided' })}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="undecided">未決定</option>
                              <option value="decided">決定済み</option>
                            </select>
                            {decision.status === 'decided' && (
                              <input
                                type="text"
                                value={decision.decision || ''}
                                onChange={(e) => onDecisionUpdate(decision.id, { decision: e.target.value })}
                                placeholder="決定内容"
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                              />
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => onDecisionDelete(decision.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="border-t p-6 flex justify-between">
          <button
            onClick={() => onDelete(task.id)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            タスクを削除
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default TaskDetailModal;