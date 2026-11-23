/**
 * jsPDF's built-in Helvetica font is limited to WinAnsi (CP1252). Unicode
 * symbols such as ✓ / ✗ / ○ render as garbage (for example "%Ë"), so PDF
 * output must use ASCII-only marks.
 */
export function serviceStatusMark(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Y';
    case 'declined':
      return 'N';
    default:
      return '-';
  }
}
