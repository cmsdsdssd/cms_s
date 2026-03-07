'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type FlowStep = {
  title: string;
  why: string;
  uiPath: string;
  apis: string[];
  checklist: string[];
};

const steps: FlowStep[] = [
  {
    title: '1) Channel Connection',
    why: 'Confirm Cafe24 channel auth before any pricing sync work.',
    uiPath: '/settings/shopping/channels',
    apis: ['/api/channels', '/api/channels/[id]/account', '/api/shop-oauth/cafe24/authorize', '/api/shop-oauth/cafe24/callback'],
    checklist: ['Channel active', 'OAuth complete', 'Tokens stored'],
  },
  {
    title: '2) Product Mapping',
    why: 'Map master items and shopping products before running pricing.',
    uiPath: '/settings/shopping/mappings',
    apis: ['/api/channel-products', '/api/channel-products/[id]', '/api/channel-products/bulk', '/api/channel-products/variants'],
    checklist: ['No missing base mapping', 'No duplicate active variants', 'Context reviewed'],
  },
  {
    title: '3) Policies and Factors',
    why: 'Pricing policies and factor sets define the base pricing behavior.',
    uiPath: '/settings/shopping/factors',
    apis: ['/api/pricing-policies', '/api/material-factor-sets', '/api/material-factor-config'],
    checklist: ['One active policy', 'Rounding checked', 'Factor set connected'],
  },
  {
    title: '4) Option Labor Rules',
    why: 'Manage category-based option labor by material, size, color, decor, and other.',
    uiPath: '/settings/shopping/rules',
    apis: ['/api/option-labor-rules', '/api/option-labor-rule-pools', '/api/channel-labor-price-adjustments', '/api/sync-rules/preview'],
    checklist: ['Context selected', 'Category deltas saved', 'Labor adjustment logs reviewed'],
  },
  {
    title: '5) Auto Price Run',
    why: 'Recompute snapshots and push results after rule updates.',
    uiPath: '/settings/shopping/auto-price',
    apis: ['/api/pricing/recompute', '/api/price-sync-runs-v2', '/api/price-sync-runs-v2/[run_id]/execute'],
    checklist: ['Compute request created', 'Run created', 'Execute result checked'],
  },
];

export default function ShoppingWorkflowPage() {
  return (
    <div className='space-y-4'>
      {steps.map((step) => (
        <Card key={step.title}>
          <CardHeader title={step.title} description={step.why} />
          <CardBody className='space-y-3'>
            <div className='text-sm text-[var(--muted)]'>UI: {step.uiPath}</div>
            <div className='flex gap-2'><Link href={step.uiPath}><Button variant='secondary' size='sm'>Open Screen</Button></Link></div>
            <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
              <div className='rounded-[var(--radius)] border border-[var(--hairline)] p-3'>
                <div className='mb-2 text-sm font-semibold'>APIs</div>
                <div className='space-y-2 text-xs'>{step.apis.map((api) => <div key={api}><code>{api}</code></div>)}</div>
              </div>
              <div className='rounded-[var(--radius)] border border-[var(--hairline)] p-3'>
                <div className='mb-2 text-sm font-semibold'>Checklist</div>
                <div className='space-y-2 text-xs'>{step.checklist.map((item) => <div key={item}>{item}</div>)}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
