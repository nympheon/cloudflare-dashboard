import Decimal from 'decimal.js';
import { obj, text, numeric, type Json } from '../json';
const classA = new Set([
  'ListBuckets',
  'PutBucket',
  'PutBucketEncryption',
  'PutBucketCors',
  'LifecycleStorageTierTransition',
  'ListObjects',
  'PutObject',
  'CopyObject',
  'CreateMultipartUpload',
  'UploadPart',
  'UploadPartCopy',
  'CompleteMultipartUpload',
  'ListMultipartUploads',
  'ListParts',
  'PutBucketLifecycleConfiguration',
  'ListObjectsV2',
]);
const classB = new Set([
  'HeadBucket',
  'HeadObject',
  'GetObject',
  'UsageSummary',
  'GetBucketEncryption',
  'GetBucketLocation',
  'GetBucketCors',
  'GetBucketLifecycleConfiguration',
]);
const free = new Set(['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload']);
export class UnverifiedR2Usage extends Error {}
export function mapR2Operations(rows: Json[]): Record<string, string> {
  const out: Record<string, string> = {
    r2_class_a_operations: '0',
    r2_class_b_operations: '0',
    r2_ia_class_a_operations: '0',
    r2_ia_class_b_operations: '0',
  };
  let mayRetrieveData = false;
  for (const raw of rows) {
    const r = obj(raw),
      d = obj(r.dimensions),
      action = text(d.actionType);
    const requests = numeric(obj(r.sum).requests);
    if (requests === null || new Decimal(requests).lt(0))
      throw new UnverifiedR2Usage('R2 操作次数缺失或无效，未将未知用量当成零');
    if (new Decimal(requests).eq(0) || free.has(action) || text(d.responseStatusCode) === '401')
      continue;
    const type = classA.has(action) ? 'a' : classB.has(action) ? 'b' : null;
    if (!type)
      throw new UnverifiedR2Usage(`R2 操作 ${action} 的计费分类待核实，使用已报告账单用量`);
    const storageClass = text(d.storageClass);
    const ia = /^(?:infrequent[_ ]?access|ia)$/i.test(storageClass);
    if (!ia && !/^standard$/i.test(storageClass))
      throw new UnverifiedR2Usage(`R2 存储类型 ${storageClass || '未知'} 的计费分类待核实`);
    const id = `r2_${ia ? 'ia_' : ''}class_${type}_operations`;
    out[id] = new Decimal(out[id]).plus(requests).toString();
    // A copy's destination can be Standard even when its source is IA.
    if ((ia && action === 'GetObject') || ['CopyObject', 'UploadPartCopy'].includes(action))
      mayRetrieveData = true;
  }
  if (!mayRetrieveData) out.r2_ia_data_retrieval = '0';
  return out;
}
