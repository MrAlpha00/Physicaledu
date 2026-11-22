/** Public board projection: first name plus surname initial only. */
export function maskVisitorName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Visitor";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function honeypotTriggered(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function describeVisitorError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid or inactive")) {
    return "This visitor QR code is invalid or has been deactivated.";
  }
  if (text.includes("purpose")) return "Choose a valid purpose of visit.";
  if (text.includes("full name")) return "Enter your full name.";
  if (text.includes("automated")) return "The submission could not be verified. Please try again.";
  return "The visitor entry could not be saved. Please try again.";
}
