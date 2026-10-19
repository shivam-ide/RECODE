/**
 * Date and Timestamp Utilities (IST - Asia/Kolkata)
 *
 * Formats timestamps in Indian Standard Time (IST, Asia/Kolkata)
 * Standard Display Format: "Mon, 19 Oct 2026, 12:01:03 PM IST"
 */

/**
 * Format any ISO string, Unix timestamp, or Date object into Indian Standard Time (IST).
 * Output format: "Mon, 19 Oct 2026, 12:01:03 PM IST"
 *
 * @param {string|number|Date} [dateInput] - Input date/timestamp
 * @returns {string} Formatted IST timestamp string
 */
export function formatIstTimestamp(dateInput) {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    if (typeof formatter.formatToParts === 'function') {
      const parts = formatter.formatToParts(d);
      const map = {};
      for (const p of parts) {
        map[p.type] = p.value;
      }

      const weekday = map.weekday || 'Mon';
      const day = (map.day || '01').padStart(2, '0');
      const month = map.month || 'Jan';
      const year = map.year || '2026';
      const hour = (map.hour || '12').padStart(2, '0');
      const minute = (map.minute || '00').padStart(2, '0');
      const second = (map.second || '00').padStart(2, '0');
      const dayPeriod = (map.dayPeriod || 'PM').toUpperCase();

      return `${weekday}, ${day} ${month} ${year}, ${hour}:${minute}:${second} ${dayPeriod} IST`;
    }

    const localized = d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${localized} IST`;
  } catch {
    return d.toISOString();
  }
}

export default formatIstTimestamp;
