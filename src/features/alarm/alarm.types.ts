export type Company = {
  id: string;
  name: string;
};

export type AlarmProvider = "RECEPTORA" | "TEM";

export type TemSettings = {
  baseUrl: string;
  apiKey: string;
  defaultPin: string;
};

export type AlarmSettings = {
  targetHost: string;
  targetPort: string;
  tem: TemSettings;
  companies: Company[];
};

export type AlarmSettingsInput = Omit<AlarmSettings, "tem"> & {
  tem?: TemSettings;
};

export type AlarmCommand = "ARMAR" | "DESARMAR";

export type AlarmCommandInput = {
  operator: string;
  client: string;
  organization: string;
  command: AlarmCommand;
};

export type TemCommand = AlarmCommand | "ISOLAR" | "DESISOLAR";

export type TemCommandInput = {
  operator: string;
  account: string;
  command: TemCommand;
  pin?: string;
  zones?: number[];
};

export type TemCommandResult = {
  success: boolean;
  command: TemCommand;
  account: string;
  httpStatus?: number;
};

export type AlarmCommandResult = {
  success: boolean;
  command: AlarmCommand;
  client: string;
  organization: string;
  companyName: string;
  httpStatus?: number;
};

export type AlarmLogStatus = "SUCCESS" | "FAILED";

export type AlarmLogEntry = {
  id: string;
  timestamp: string;
  operator: string;
  client: string;
  companyId: string;
  companyName: string;
  command: TemCommand;
  zones?: number[];
  provider?: AlarmProvider;
  url: string;
  status: AlarmLogStatus;
  httpStatus?: number;
  errorMessage?: string;
};

export type AlarmSchedule = {
  id: string;
  operator: string;
  client: string;
  organization: string;
  companyName: string;
  command: AlarmCommand;
  datetime: string;
  provider?: AlarmProvider;
};

export type TemScheduleInput = {
  operator: string;
  account: string;
  command: AlarmCommand;
  datetime: string;
};
