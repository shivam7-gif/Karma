export type AppBuilderProviderId = 'manus' | 'replit' | 'auto';

export interface AppBuildSpecification {
  title: string;
  userPrompt: string;
  summary: string;
  targetPlatform: 'web' | 'mobile' | 'fullstack';
  features: {
    customerFacing: string[];
    authentication: string[];
    restaurantListingsAndSearch: string[];
    cartAndCheckout: string[];
    orderStatusAndTracking: string[];
    adminAndRestaurantDashboard: string[];
    backendAndDatabase: string[];
    validationAndErrorStates: string[];
    mobileAndAccessibility: string[];
  };
  mockPaymentNotice: string;
  setupAndEnvVars: string[];
  technicalStackPreference?: string;
  fullMarkdownBrief: string;
}

export interface BuildProjectRequest {
  name: string;
  specification: AppBuildSpecification;
  sessionId: string;
  userId: string;
  sourceRepoUrl?: string;
  providerPreference?: AppBuilderProviderId;
}

export type BuildTaskStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'manual_action_required'
  | 'cancelled';

export interface BuildTaskResult {
  taskId: string;
  projectId?: string | undefined;
  provider: AppBuilderProviderId;
  providerName: string;
  status: BuildTaskStatus;
  statusMessage: string;
  previewUrl?: string | undefined;
  projectUrl?: string | undefined;
  repoUrl?: string | undefined;
  outputSummary: string;
  manualActionsRemaining?: string[] | undefined;
  continueActionUrl?: string | undefined;
  continueActionLabel?: string | undefined;
  creditsUsed?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
  error?: string | undefined;
}

export interface AppBuilderProvider {
  id: AppBuilderProviderId;
  name: string;
  description: string;
  checkAvailability(): Promise<{ available: boolean; reason?: string | undefined }>;
  createProject(request: BuildProjectRequest): Promise<{ projectId: string; projectUrl?: string | undefined }>;
  submitBuildTask(
    projectId: string,
    specification: AppBuildSpecification,
    options?: {
      signal?: AbortSignal | undefined;
      onProgress?: ((event: { status: BuildTaskStatus; message: string; data?: unknown }) => void) | undefined;
    } | undefined
  ): Promise<{ taskId: string; initialStatus: BuildTaskStatus; message?: string | undefined }>;
  getTaskStatus(taskId: string): Promise<{
    status: BuildTaskStatus;
    message?: string | undefined;
    previewUrl?: string | undefined;
    projectUrl?: string | undefined;
    creditsUsed?: number | undefined;
  }>;
  getTaskResult(taskId: string): Promise<BuildTaskResult>;
  cancelTask?(taskId: string): Promise<boolean>;
  getPreviewUrl?(projectId: string): Promise<string | undefined>;
}
