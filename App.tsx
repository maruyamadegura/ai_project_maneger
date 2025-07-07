import React, { useState, useCallback, useEffect } from 'react';
import { 
  ProjectTask, 
  ViewState, 
  ProjectFileContent, 
  ExtendedTaskDetails,
  TaskStatus, 
  EditableExtendedTaskDetails,
  SubStep,
  Attachment,
  GanttItem,
  Decision,
  SlideDeck
} from './types';
import { generateProjectPlan, initializeGemini } from './services/geminiService';
import { ProjectService, ProjectData } from './services/projectService';
import { CollaborationService } from './services/collaborationService';
import { supabase } from './lib/supabase';
import ProjectInputForm from './components/ProjectInputForm';
import ProjectFlowDisplay from './components/ProjectFlowDisplay';
import TaskDetailModal from './components/TaskDetailModal';
import ErrorMessage from './components/ErrorMessage';
import AddTaskModal from './components/AddTaskModal';
import ConfirmNewProjectModal from './components/ConfirmNewProjectModal';
import SlideEditorView from './components/SlideEditorView';
import ApiKeyModal from './components/ApiKeyModal';
import AuthModal from './components/AuthModal';
import ProjectListModal from './components/ProjectListModal';
import InvitationAcceptModal from './components/InvitationAcceptModal';

const defaultExtendedDetails: ExtendedTaskDetails = {
  subSteps: [],
  resources: '',
  responsible: '',
  notes: '',
  numericalTarget: undefined,
  dueDate: '',
  reportDeck: undefined,
  resourceMatrix: null,
  attachments: [],
  decisions: [],
  subStepCanvasSize: { width: 1200, height: 800 }
};

const getDefaultSubStepPosition = (index: number): { x: number; y: number } => ({
  x: 10, 
  y: index * 90 + 10 
});

function App() {
  const [viewState, setViewState] = useState<ViewState>('input');
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showConfirmNewProject, setShowConfirmNewProject] = useState(false);
  const [pendingProjectData, setPendingProjectData] = useState<ProjectFileContent | null>(null);
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [currentSlideDeck, setCurrentSlideDeck] = useState<SlideDeck | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [showProjectList, setShowProjectList] = useState(false);
  const [showInvitationAccept, setShowInvitationAccept] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('invitation');
    if (token) {
      setInvitationToken(token);
      setShowInvitationAccept(true);
    }
  }, []);

  const handleProjectGenerated = useCallback(async (projectData: ProjectFileContent) => {
    if (currentProject) {
      setPendingProjectData(projectData);
      setShowConfirmNewProject(true);
    } else {
      await applyProjectData(projectData);
    }
  }, [currentProject]);

  const applyProjectData = useCallback(async (projectData: ProjectFileContent) => {
    const tasksWithDetails = projectData.tasks.map(task => ({
      ...task,
      extendedDetails: { ...defaultExtendedDetails }
    }));
    
    setTasks(tasksWithDetails);
    setViewState('flow');
    setError(null);

    if (user) {
      try {
        const project = await ProjectService.createProject({
          title: projectData.title,
          goal: projectData.goal,
          targetDate: projectData.targetDate,
          tasks: tasksWithDetails,
          ganttData: projectData.ganttData || null
        });
        setCurrentProject(project);
      } catch (error) {
        console.error('Failed to save project:', error);
        setError('Failed to save project. You can continue working, but changes won\'t be saved.');
      }
    }
  }, [user]);

  const handleConfirmNewProject = useCallback(async () => {
    if (pendingProjectData) {
      await applyProjectData(pendingProjectData);
      setPendingProjectData(null);
    }
    setShowConfirmNewProject(false);
  }, [pendingProjectData, applyProjectData]);

  const handleTaskClick = useCallback((task: ProjectTask) => {
    setSelectedTask(task);
  }, []);

  const handleTaskUpdate = useCallback(async (updatedTask: ProjectTask) => {
    const updatedTasks = tasks.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    );
    setTasks(updatedTasks);
    setSelectedTask(updatedTask);

    if (currentProject && user) {
      try {
        await ProjectService.updateProject(currentProject.id, {
          tasks: updatedTasks,
          lastModifiedBy: user.id
        });
        
        await CollaborationService.logActivity(
          currentProject.id,
          user.id,
          'task_updated',
          { taskId: updatedTask.id, taskTitle: updatedTask.title }
        );
      } catch (error) {
        console.error('Failed to update project:', error);
        setError('Failed to save changes. Please try again.');
      }
    }
  }, [tasks, currentProject, user]);

  const handleAddTask = useCallback(async (newTask: Omit<ProjectTask, 'id'>) => {
    const taskWithId: ProjectTask = {
      ...newTask,
      id: Date.now().toString(),
      extendedDetails: { ...defaultExtendedDetails }
    };
    
    const updatedTasks = [...tasks, taskWithId];
    setTasks(updatedTasks);
    setShowAddTaskModal(false);

    if (currentProject && user) {
      try {
        await ProjectService.updateProject(currentProject.id, {
          tasks: updatedTasks,
          lastModifiedBy: user.id
        });
        
        await CollaborationService.logActivity(
          currentProject.id,
          user.id,
          'task_created',
          { taskId: taskWithId.id, taskTitle: taskWithId.title }
        );
      } catch (error) {
        console.error('Failed to save new task:', error);
        setError('Failed to save new task. Please try again.');
      }
    }
  }, [tasks, currentProject, user]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    setTasks(updatedTasks);
    setSelectedTask(null);

    if (currentProject && user) {
      try {
        await ProjectService.updateProject(currentProject.id, {
          tasks: updatedTasks,
          lastModifiedBy: user.id
        });
        
        const deletedTask = tasks.find(t => t.id === taskId);
        await CollaborationService.logActivity(
          currentProject.id,
          user.id,
          'task_deleted',
          { taskId, taskTitle: deletedTask?.title || 'Unknown' }
        );
      } catch (error) {
        console.error('Failed to delete task:', error);
        setError('Failed to delete task. Please try again.');
      }
    }
  }, [tasks, currentProject, user]);

  const handleNewProject = useCallback(() => {
    setViewState('input');
    setTasks([]);
    setSelectedTask(null);
    setError(null);
    setCurrentProject(null);
  }, []);

  const handleLoadProject = useCallback(async (project: ProjectData) => {
    try {
      setCurrentProject(project);
      setTasks(project.tasks || []);
      setViewState('flow');
      setShowProjectList(false);
      setError(null);
    } catch (error) {
      console.error('Failed to load project:', error);
      setError('Failed to load project. Please try again.');
    }
  }, []);

  const handleOpenSlideEditor = useCallback((slideDeck: SlideDeck) => {
    setCurrentSlideDeck(slideDeck);
    setShowSlideEditor(true);
  }, []);

  const handleSaveSlides = useCallback(async (updatedSlideDeck: SlideDeck) => {
    if (!selectedTask) return;

    const updatedTask = {
      ...selectedTask,
      extendedDetails: {
        ...selectedTask.extendedDetails,
        reportDeck: updatedSlideDeck
      }
    };

    await handleTaskUpdate(updatedTask);
    setCurrentSlideDeck(updatedSlideDeck);
  }, [selectedTask, handleTaskUpdate]);

  const handleSubStepUpdate = useCallback(async (subSteps: SubStep[]) => {
    if (!selectedTask) return;

    const updatedTask = {
      ...selectedTask,
      extendedDetails: {
        ...selectedTask.extendedDetails,
        subSteps
      }
    };

    await handleTaskUpdate(updatedTask);
  }, [selectedTask, handleTaskUpdate]);

  const handleSubStepAdd = useCallback(async (title: string, description: string) => {
    if (!selectedTask) return;

    const newSubStep: SubStep = {
      id: Date.now().toString(),
      title,
      description,
      status: 'pending',
      position: getDefaultSubStepPosition(selectedTask.extendedDetails.subSteps.length)
    };

    const updatedSubSteps = [...selectedTask.extendedDetails.subSteps, newSubStep];
    await handleSubStepUpdate(updatedSubSteps);
  }, [selectedTask, handleSubStepUpdate]);

  const handleSubStepDelete = useCallback(async (subStepId: string) => {
    if (!selectedTask) return;

    const updatedSubSteps = selectedTask.extendedDetails.subSteps.filter(
      subStep => subStep.id !== subStepId
    );
    await handleSubStepUpdate(updatedSubSteps);
  }, [selectedTask, handleSubStepUpdate]);

  const handleSubStepStatusChange = useCallback(async (subStepId: string, status: TaskStatus) => {
    if (!selectedTask) return;

    const updatedSubSteps = selectedTask.extendedDetails.subSteps.map(subStep =>
      subStep.id === subStepId ? { ...subStep, status } : subStep
    );
    await handleSubStepUpdate(updatedSubSteps);
  }, [selectedTask, handleSubStepUpdate]);

  const handleAttachmentAdd = useCallback(async (attachment: Omit<Attachment, 'id'>) => {
    if (!selectedTask) return;

    const newAttachment: Attachment = {
      ...attachment,
      id: Date.now().toString()
    };

    const updatedTask = {
      ...selectedTask,
      extendedDetails: {
        ...selectedTask.extendedDetails,
        attachments: [...selectedTask.extendedDetails.attachments, newAttachment]
      }
    };

    await handleTaskUpdate(updatedTask);
  }, [selectedTask, handleTaskUpdate]);

  const handleAttachmentDelete = useCallback(async (attachmentId: string) => {
    if (!selectedTask) return;

    const updatedTask = {
      ...selectedTask,
      extendedDetails: {
        ...selectedTask.extendedDetails,
        attachments: selectedTask.extendedDetails.attachments.filter(
          attachment => attachment.id !== attachmentId
        )
      }
    };

    await handleTaskUpdate(updatedTask);
  }, [selectedTask, handleTaskUpdate]);

  const handleDecisionAdd = useCallback(async (decision: Omit<Decision, 'id'>) => {
    if (!selectedTask) return;

    const newDecision: Decision = {
      ...decision,
      id: Date.now().toString()
    };

    const updatedTask = {
      ...selectedTask,
      extendedDetails: {
        ...selectedTask.extendedDetails,
        decisions: [...selectedTask.extendedDetails.decisions, newDecision]
      }
    };

    await handleTaskUpdate(updatedTask);
  }, [selectedTask, handleTaskUpdate]);

  const handleDecisionUpdate = useCallback(async (decisionId: string, updates: Partial<Decision>) => {
    if (!selectedTask) return;

    const updatedTask = {
      ...selectedTask,
      extendedDetails: {
        ...selectedTask.extendedDetails,
        decisions: selectedTask.extendedDetails.decisions.map(decision =>
          decision.id === decisionId ? { ...decision, ...updates } : decision
        )
      }
    };

    await handleTaskUpdate(updatedTask);
  }, [selectedTask, handleTaskUpdate]);

  const handleDecisionDelete = useCallback(async (decisionId: string) => {
    if (!selectedTask) return;

    const updatedTask = {
      ...selectedTask,
      extendedDetails: {
        ...selectedTask.extendedDetails,
        decisions: selectedTask.extendedDetails.decisions.filter(
          decision => decision.id !== decisionId
        )
      }
    };

    await handleTaskUpdate(updatedTask);
  }, [selectedTask, handleTaskUpdate]);

  const handleCanvasSizeUpdate = useCallback(async (size: { width: number; height: number }) => {
    if (!selectedTask) return;

    const updatedTask = {
      ...selectedTask,
      extendedDetails: {
        ...selectedTask.extendedDetails,
        subStepCanvasSize: size
      }
    };

    await handleTaskUpdate(updatedTask);
  }, [selectedTask, handleTaskUpdate]);

  const handleInvitationAccepted = useCallback(() => {
    setShowInvitationAccept(false);
    setInvitationToken(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  if (showSlideEditor && currentSlideDeck) {
    return (
      <SlideEditorView
        slideDeck={currentSlideDeck}
        onSave={handleSaveSlides}
        onClose={() => setShowSlideEditor(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {viewState === 'input' && (
        <ProjectInputForm
          onProjectGenerated={handleProjectGenerated}
          onError={setError}
          onLoadingChange={setIsLoading}
          onShowApiKeyModal={() => setShowApiKeyModal(true)}
          onShowAuth={() => setShowAuthModal(true)}
          onShowProjectList={() => setShowProjectList(true)}
          user={user}
          currentProject={currentProject}
        />
      )}

      {viewState === 'flow' && (
        <ProjectFlowDisplay
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onNewProject={handleNewProject}
          onAddTask={() => setShowAddTaskModal(true)}
          onShowAuth={() => setShowAuthModal(true)}
          onShowProjectList={() => setShowProjectList(true)}
          user={user}
          currentProject={currentProject}
        />
      )}

      {error && (
        <ErrorMessage
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleDeleteTask}
          onOpenSlideEditor={handleOpenSlideEditor}
          onSubStepUpdate={handleSubStepUpdate}
          onSubStepAdd={handleSubStepAdd}
          onSubStepDelete={handleSubStepDelete}
          onSubStepStatusChange={handleSubStepStatusChange}
          onAttachmentAdd={handleAttachmentAdd}
          onAttachmentDelete={handleAttachmentDelete}
          onDecisionAdd={handleDecisionAdd}
          onDecisionUpdate={handleDecisionUpdate}
          onDecisionDelete={handleDecisionDelete}
          onCanvasSizeUpdate={handleCanvasSizeUpdate}
        />
      )}

      {showAddTaskModal && (
        <AddTaskModal
          onClose={() => setShowAddTaskModal(false)}
          onAdd={handleAddTask}
        />
      )}

      {showConfirmNewProject && (
        <ConfirmNewProjectModal
          onConfirm={handleConfirmNewProject}
          onCancel={() => {
            setShowConfirmNewProject(false);
            setPendingProjectData(null);
          }}
        />
      )}

      {showApiKeyModal && (
        <ApiKeyModal
          onClose={() => setShowApiKeyModal(false)}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {showProjectList && (
        <ProjectListModal
          onClose={() => setShowProjectList(false)}
          onLoadProject={handleLoadProject}
          user={user}
        />
      )}

      {showInvitationAccept && invitationToken && (
        <InvitationAcceptModal
          token={invitationToken}
          onClose={() => {
            setShowInvitationAccept(false);
            setInvitationToken(null);
          }}
          onAccepted={handleInvitationAccepted}
        />
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Generating project plan...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;