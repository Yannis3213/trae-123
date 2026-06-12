export class CreatePlanDto {
  title: string;
  type: string;
  priority: string;
  dueDate: string;
  responsiblePerson: string;
}

export class SignPlanDto {
  version: number;
}

export class ReviewPlanDto {
  result: string;
  auditNote?: string;
  returnReason?: string;
  version: number;
}

export class VerifyPlanDto {
  result: string;
  auditNote?: string;
  rejectReason?: string;
  version: number;
}

export class CorrectPlanDto {
  auditNote?: string;
  version: number;
}

export class BatchSignDto {
  planIds: number[];
}

export class BatchVerifyDto {
  planIds: number[];
  result: string;
  auditNote?: string;
}

export class QueryPlanDto {
  status?: string;
  type?: string;
  priority?: string;
  dueWarning?: string;
  responsiblePerson?: string;
  exceptionTag?: string;
}
