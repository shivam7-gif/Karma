export type OverlayState =
  | 'idle'
  | 'thinking'
  | 'controlling_screen'
  | 'searching'
  | 'analyzing'
  | 'opening_product'
  | 'adding_to_cart'
  | 'checkout_review'
  | 'stopped'
  | 'error';

export interface CandidateSummary {
  id: number;
  title: string;
  price: string;
  rating?: string | undefined;
  url?: string | undefined;
  status: 'selected' | 'shortlisted' | 'rejected';
}

export interface ProductIntelligenceData {
  activity?: string | undefined;
  candidatesFound?: number | undefined;
  candidatesEvaluated?: number | undefined;
  budgetINR?: number | undefined;
  currentProduct?: {
    id?: number | undefined;
    title: string;
    price: string;
    rating?: string | undefined;
    reviews?: string | undefined;
    url?: string | undefined;
    status?: 'evaluating' | 'selected' | 'rejected' | 'verified' | undefined;
    budgetComparison?: string | undefined;
  } | undefined;
  candidates?: CandidateSummary[] | undefined;
  reasoningSummary?: string | undefined;
  checkoutStatus?: string | undefined;
}

export interface OverlayStatusUpdate {
  type: 'status';
  state: OverlayState;
  action?: string | undefined;
  details?: string | undefined;
  intel?: ProductIntelligenceData | undefined;
}

export interface OverlayStopEvent {
  type: 'stop';
  reason: 'escape_pressed' | 'button_clicked' | 'signal';
  timestamp: number;
}

export interface OverlayCloseCommand {
  type: 'close';
}

export type OverlayInboundMessage = OverlayStatusUpdate | OverlayCloseCommand;
export type OverlayOutboundMessage =
  | OverlayStopEvent
  | { type: 'ready'; display: { width: number; height: number } }
  | { type: 'pong' };

export const DEFAULT_STATUS_MESSAGES: Record<OverlayState, string> = {
  idle: 'Ready',
  thinking: 'Thinking...',
  controlling_screen: 'Karma is controlling the screen',
  searching: 'Searching Amazon',
  analyzing: 'Comparing products',
  opening_product: 'Inspecting product',
  adding_to_cart: 'Adding to cart',
  checkout_review: 'Checkout review',
  stopped: 'Automation stopped',
  error: 'An error occurred',
};
