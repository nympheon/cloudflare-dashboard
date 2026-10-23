import { describe, expect, it } from 'vitest';
import { metricById } from '../../shared/catalog';
import type { Observation } from '../../shared/dashboard';
import { meterCost } from '../../worker/billing/calculate';
import { mapR2Operations } from '../../worker/cloudflare/adapters/storage';

const observation: Observation = {
  usage: '0',
  status: 'ok',
  coverage: 'complete',
  at: '2026-10-23T08:00:00Z',
  source: 'fixture',
  period: {
    kind: 'billing_cycle',
    start: '2026-10-15T00:00:00Z',
    end: '2026-11-15T00:00:00Z',
    timeZone: 'UTC',
  },
};

describe('published billing increments', () => {
  it.each([
    ['worker_durable_objects_requests', '1500000', '0.15'],
    ['worker_durable_objects_requests', '1000000', '0'],
    ['worker_durable_objects_duration', '900000', '12.5'],
    ['worker_durable_objects_duration', '1400000', '12.5'],
    ['browser_rendering_total_browser_hours', '10.25', '0'],
    ['browser_rendering_total_browser_hours', '10.5', '0.09'],
    ['browser_rendering_total_browser_hours', '9.99', '0'],
    ['r2_ia_data_retrieval', '1.1', '0.02'],
    ['r2_storage', '11.1', '0.03'],
    ['r2_ia_storage', '1.1', '0.02'],
    ['worker_standard_request', '12500000', '0.75'],
  ])('%s prices %s at $%s', (id, usage, expected) => {
    expect(meterCost({ ...observation, usage }, metricById[id].pricing!)).toBe(expected);
  });
  it('keeps partial quantities unpriced and uses an actual reported charge unchanged', () => {
    const rule = metricById.r2_storage.pricing!;
    expect(meterCost({ ...observation, usage: '11.1', coverage: 'partial' }, rule)).toBeNull();
    expect(meterCost({ ...observation, usage: '11.1', reportedCost: '0.016' }, rule)).toBe('0.016');
  });
});

describe('R2 billable operation coverage', () => {
  const row = (
    actionType: string,
    storageClass = 'Standard',
    requests: string | null = '1000001',
  ) => ({
    dimensions: { actionType, storageClass },
    sum: { requests },
  });
  it.each(['PutBucket', 'PutBucketEncryption', 'PutBucketCors', 'LifecycleStorageTierTransition'])(
    'includes %s in the class A balance',
    (action) => {
      expect(mapR2Operations([row(action)]).r2_class_a_operations).toBe('1000001');
      expect(mapR2Operations([row(action, 'InfrequentAccess')]).r2_ia_class_a_operations).toBe(
        '1000001',
      );
    },
  );
  it.each(['CopyObject', 'UploadPartCopy'])(
    'does not infer zero retrieval bytes from %s',
    (action) => {
      expect(
        mapR2Operations([row(action, 'InfrequentAccess')]).r2_ia_data_retrieval,
      ).toBeUndefined();
      // A copy to Standard can still retrieve an IA source object.
      expect(mapR2Operations([row(action)]).r2_ia_data_retrieval).toBeUndefined();
    },
  );
  it('does not silently discard an unknown operation or a missing request count', () => {
    expect(() => mapR2Operations([row('UnclassifiedOperation')])).toThrow();
    expect(() => mapR2Operations([row('PutObject', 'Standard', null)])).toThrow();
  });
  it('continues excluding documented free operations', () => {
    const actual = mapR2Operations(
      ['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload'].map((a) => row(a)),
    );
    expect(actual.r2_class_a_operations).toBe('0');
    expect(actual.r2_class_b_operations).toBe('0');
  });
  it('excludes unauthorized HTTP 401 operations and their apparent retrieval activity', () => {
    const denied = row('GetObject', 'InfrequentAccess');
    const result = mapR2Operations([
      { ...denied, dimensions: { ...denied.dimensions, responseStatusCode: '401' } },
    ]);
    expect(result.r2_ia_class_b_operations).toBe('0');
    expect(result.r2_ia_data_retrieval).toBe('0');
  });
  it('does not assign an unfamiliar storage class to the Standard free allowance', () => {
    expect(() => mapR2Operations([row('PutObject', 'UnknownTier')])).toThrow();
  });
});
