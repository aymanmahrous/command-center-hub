export function isOverdueFollowUp(status: string, scheduledDateIsPast: boolean): boolean {
  return scheduledDateIsPast && (status === "queued" || status === "retrying");
}

export function matchesQueueStatus(status: string, filter: string, isOverdue = false): boolean {
  if (filter === "all") return true;
  if (filter === "overdue") return isOverdue;
  return status === filter;
}
