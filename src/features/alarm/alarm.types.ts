export type Company = {
  id: string;
  name: string;
};

export type AlarmSettings = {
  targetHost: string;
  targetPort: string;
  companies: Company[];
};

export type AlarmCommand = "ARMAR" | "DESARMAR";

export type AlarmCommandInput = {
  operator: string;
  client: string;
  organization: string;
  command: AlarmCommand;
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
  command: AlarmCommand;
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
};
