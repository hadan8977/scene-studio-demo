// ── 场景领域模型 ─────────────────────────────────────────────
// 一份结构化场景数据。模型只负责"提议"，验证器负责裁决。

export type ActionGroup = '光' | '声' | '气' | '温' | '话' | '供' | '其他';

// 能力成熟度 / 裁决后状态
export type ActionStatus =
  | 'available' // 可用：正常呈现
  | 'adjusted' // 已调整：保留请求与最终值 + 原因
  | 'unsupported' // 不支持：做不了
  | 'forbidden' // 禁止：被安全或负面偏好规则排除
  | 'planned' // 规划中：尚未落地
  | 'proposed'; // 提议中：需共建，不是现有能力

export interface Action {
  stage?: number;
  id: string;
  group: ActionGroup;
  /** 能力键，对应注册表 */
  capability: string;
  /** 作用对象的自然语言描述，如"主驾座椅"、"氛围灯" */
  target: string;
  /** 用户/模型请求的原始值（自然语言或数值） */
  requested: string;
  /** 裁决后的最终值；不支持时可为 null */
  finalValue: string | null;
  status: ActionStatus;
  /** 调整 / 不支持 / 规划 / 提议 的简短原因 */
  reason?: string;
}

export type ConditionStatus =
  | 'available'
  | 'planned'
  | 'proposed'
  | 'unsupported';

export interface Condition {
  id: string;
  label: string;
  status: ConditionStatus;
  reason?: string;
}

export interface OfferItem {
  id: string;
  label: string;
  /** 后续服务通常是提议/规划 */
  status: 'proposed' | 'planned';
}

export interface MemoryHit {
  id: string;
  label: string;
  /** 负面偏好（如"不喜欢香氛"）优先级更高 */
  negative?: boolean;
}

export interface Warning {
  id: string;
  label: string;
  kind: 'adjusted' | 'rejected' | 'injection' | 'info';
}

export type Intent =
  | '动作' // 明确动作指令
  | '精准条件'
  | '模糊目标'
  | '情绪'
  | '追问'
  | '无关';

export interface ClarifyRequest {
  question: string;
  /** 追问的对象/上下文，回答后续接同一流程 */
  pendingField?: string;
}

// 模型返回的"原始"场景（尚未过验证器）
export interface RawScene {
  understanding: string;
  relevance: number;
  intent: Intent;
  name: string;
  logic: string;
  conditions: Condition[];
  actions: Action[];
  say?: string;
  offer?: OfferItem[];
  memory?: MemoryHit[];
  unsupported?: Action[];
  warnings?: Warning[];
  clarify?: ClarifyRequest | null;
}

// 验证器裁决后的最终场景
export interface Scene extends RawScene {
  offer: OfferItem[];
  memory: MemoryHit[];
  unsupported: Action[];
  warnings: Warning[];
  clarify: ClarifyRequest | null;
  /** 是否允许保存（无法表达的触发条件等会阻止保存） */
  canSave: boolean;
  /** 阻止保存的原因（供 UI 提示改条件） */
  blockReason?: string;
}

// 每条动作的验证器裁决记录（用于评审视图）
export interface Verdict {
  status?: string;
  capability: string;
  requested: string;
  outcome: 'kept' | 'adjusted' | 'rejected';
  finalValue: string | null;
  reason?: string;
}

// 一次生成的完整结果（含裁决记录）
export interface GenerationResult {
  scene: Scene;
  raw: RawScene;
  verdicts: Verdict[];
}

// 已保存的场景条目
export interface SavedScene {
  origin?: import('../../../lib/nonvoice').SceneOrigin;
  id: string;
  scene: Scene;
  source: 'example' | 'ai';
  input: string;
  profileId: string;
  savedAt: number;
}

// 记忆档案
export interface Preference {
  id: string;
  label: string;
  negative?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  blurb: string;
  preferences: Preference[];
}

export type DrivingState = 'parked' | 'driving';

export interface GenerateRequest {
  input: string;
  profile: Profile;
  driving: DrivingState;
  model: string;
  /** 局部修改：基于已有场景改一处 */
  base?: Scene;
  /** 追问的回答，续接同一流程 */
  clarifyAnswer?: string;
  /** 历史输入，用于上下文 */
  history?: string[];
}

// 服务分阶段回调（真实模式跟随实际返回，不伪造）
export interface StageEvents {
  onUnderstandingStart?: () => void;
  onUnderstandingDone?: (understanding: string) => void;
  onComplete?: () => void;
}

export interface ServiceOptions {
  signal?: AbortSignal;
  stages?: StageEvents;
}

export interface SceneService {
  mode: 'real' | 'example';
  generate(
    req: GenerateRequest,
    opts?: ServiceOptions,
  ): Promise<GenerationResult>;
}
