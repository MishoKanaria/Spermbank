/**
 * Parses a remark string, handling both JSON and hex-encoded formats
 */
export function parseRemark(remark?: string): string | object | undefined {
  if (!remark) return undefined;
  
  try {
    // First try parsing as JSON
    return JSON.parse(remark);
  } catch {
    try {
      // If JSON parsing fails, try parsing as hex
      const cleanRemark = remark.startsWith('0x') ? remark.slice(2) : remark;
      const decodedRemark = Buffer.from(cleanRemark, 'hex').toString();
      return JSON.parse(decodedRemark);
    } catch {
      // If both fail, return the original remark
      return remark;
    }
  }
} 