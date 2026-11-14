import { CONFIG } from './config.js';
import { validateScanword } from './validator.js';
export function exportScanword(scanword, dictionary = []) {
  const validation = validateScanword(scanword, dictionary);
  if (!validation.valid) throw new Error(`Отказ от экспорта невалидной сетки: ${validation.errors.map(e => e.type).join(', ')}`);
  const json = JSON.stringify(scanword, null, 2);
  const parsed = JSON.parse(json);
  if (parsed.width !== CONFIG.WIDTH || parsed.height !== CONFIG.HEIGHT) throw new Error('Ошибка проверки JSON-размеров.');
  return json;
}
export function importScanword(json, dictionary = []) {
  const value = typeof json === 'string' ? JSON.parse(json) : json;
  const validation = validateScanword(value, dictionary);
  return { scanword: value, ...validation };
}