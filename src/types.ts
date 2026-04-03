import { z } from 'zod';

// Common validation schemas
export const dateSchema = () =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
export const timeSchema = () =>
  z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format');
export const issueKeySchema = () =>
  z.string().min(1, 'Issue key cannot be empty');
export const issueIdSchema = () =>
  z.union([
    z.string().min(1, 'Issue ID cannot be empty'),
    z.number().int().positive('Issue ID must be a positive integer'),
  ]);
export const idOrKeySchema = () => z.union([issueKeySchema(), issueIdSchema()]);

// Environment validation
export const envSchema = z
  .object({
    TEMPO_API_TOKEN: z.string().min(1, 'TEMPO_API_TOKEN is required'),
    JIRA_BASE_URL: z.string().min(1, 'JIRA_BASE_URL is required'),
    JIRA_API_TOKEN: z.string().min(1, 'JIRA_API_TOKEN is required'),
    JIRA_EMAIL: z.string().optional(),
    JIRA_AUTH_TYPE: z.enum(['basic', 'bearer']).optional().default('basic'),
    JIRA_TEMPO_ACCOUNT_CUSTOM_FIELD_ID: z.string().optional(),
  })
  .refine((data) => data.JIRA_AUTH_TYPE === 'bearer' || data.JIRA_EMAIL, {
    message: 'JIRA_EMAIL is required when using basic authentication',
  });

export type Env = z.infer<typeof envSchema>;

// Worklog entry schema
export const worklogEntrySchema = z.object({
  issueKey: issueKeySchema(),
  timeSpentHours: z.number().positive('Time spent must be positive'),
  date: dateSchema(),
  description: z.string().optional(),
  startTime: timeSchema().optional(),
});

export type WorklogEntry = z.infer<typeof worklogEntrySchema>;

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getStartOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// MCP tool schemas
export const retrieveWorklogsSchema = z.object({
  startDate: dateSchema().default(getStartOfWeek),
  endDate: dateSchema().default(getToday),
});

export const createWorklogSchema = z.object({
  issueKey: issueKeySchema(),
  timeSpentHours: z
    .number()
    .positive('Time spent must be positive')
    .default(1.5),
  date: dateSchema(),
  description: z.string(),
  startTime: timeSchema().optional().default('08:00'),
  remainingEstimateHours: z
    .number()
    .nonnegative('Remaining estimate must be non-negative')
    .optional(),
});

export const bulkCreateWorklogsSchema = z.object({
  worklogEntries: z
    .array(worklogEntrySchema)
    .min(1, 'At least one worklog entry is required'),
});

export const editWorklogSchema = z.object({
  worklogId: z.string().min(1, 'Worklog ID is required'),
  timeSpentHours: z.number().positive('Time spent must be positive'),
  description: z.string().optional().nullable(),
  date: dateSchema().optional().nullable(),
  startTime: timeSchema().optional(),
});

export const deleteWorklogSchema = z.object({
  worklogId: z.string().min(1, 'Worklog ID is required'),
});

// API interfaces
export interface JiraUser {
  self?: string;
  accountId: string;
  accountType?: string;
  active?: boolean;
  displayName?: string;
  emailAddress?: string;
  avatarUrls?: {
    '16x16': string;
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
}

export interface JiraIssueResponse {
  id: string;
  key: string;
  self: string;
  fields: {
    summary?: string;
    [key: string]: unknown;
  };
}

export interface TempoWorklog {
  tempoWorklogId: number;
  issue: {
    self: string;
    id: number;
  };
  timeSpentSeconds: number;
  billableSeconds?: number;
  startDate: string;
  startTime?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  author: {
    self: string;
    accountId: string;
  };
  attributes?: {
    self: string;
    values: Array<{
      key: string;
      value: string;
    }>;
  };
}

export interface TempoWorklogListMetadata {
  count: number;
  offset: number;
  limit: number;
  next?: string;
}

export interface TempoWorklogListResponse {
  results: TempoWorklog[];
  metadata: TempoWorklogListMetadata;
}

export interface TempoAccountResponse {
  self: string;
  id: number;
  key: string;
  name: string;
  status?: string;
  global?: boolean;
  monthlyBudget?: number;
}

// MCP response interfaces
export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  metadata?: Record<string, any>;
  isError?: boolean;
}

// Result tracking interfaces
export interface WorklogResult {
  issueKey: string;
  timeSpentHours: number;
  date: string;
  worklogId: number | null;
  success: boolean;
  startTime?: string;
  endTime?: string;
  account?: string;
}

export interface WorklogError {
  issueKey: string;
  timeSpentHours: number;
  date: string;
  error: string;
}

export interface Config {
  tempoApi: { baseUrl: string; token: string };
  jiraApi: {
    baseUrl: string;
    token: string;
    email?: string;
    /**
     * Authentication type for Jira API.
     * - 'basic': Uses Basic Auth with email:token (default, requires JIRA_EMAIL)
     * - 'bearer': Uses Bearer token auth (for OAuth 2.0 scoped tokens)
     */
    authType: 'basic' | 'bearer';
    /**
     * The id of the custom Jira field Id which links jira issues to Tempo accounts.
     * This must be set if your organization has configured a mandatory tempo custom work attribute of type "Account".
     * Example: "10234"
     */
    tempoAccountCustomFieldId?: string;
  };
  server: { name: string; version: string };
}
