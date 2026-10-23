import Decimal from 'decimal.js';
import { obj, text, numeric, type Json } from '../json';
const classA = new Set([
  'ListBuckets',
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
export function mapR2Operations(rows: Json[]): Record<string, string> {
  const out: Record<string, string> = {
    r2_class_a_operations: '0',
    r2_class_b_operations: '0',
    r2_ia_class_a_operations: '0',
    r2_ia_class_b_operations: '0',
  };
  for (const raw of rows) {
    const r = obj(raw),
      d = obj(r.dimensions),
      action = text(d.actionType);
    const type = classA.has(action) ? 'a' : classB.has(action) ? 'b' : null;
    if (!type) continue;
    const ia = /infrequent|^ia$/i.test(text(d.storageClass));
    const id = `r2_${ia ? 'ia_' : ''}class_${type}_operations`;
    out[id] = new Decimal(out[id]).plus(numeric(obj(r.sum).requests) ?? 0).toString();
  }
  if (
    !rows.some((raw) => {
      const r = obj(raw),
        d = obj(r.dimensions);
      return (
        /infrequent|^ia$/i.test(text(d.storageClass)) &&
        text(d.actionType) === 'GetObject' &&
        Number(obj(r.sum).requests) > 0
      );
    })
  )
    out.r2_ia_data_retrieval = '0';
  return out;
}
