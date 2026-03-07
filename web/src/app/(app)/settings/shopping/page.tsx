'use client';

import Link from 'next/link';
import { ActionBar } from '@/components/layout/action-bar';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const groups = [
  {
    title: 'Operate',
    items: [
      { href: '/settings/shopping/mappings', title: 'Product Mapping', desc: 'Match master items and shopping products first.' },
      { href: '/settings/shopping/rules', title: 'Option Labor Rules', desc: 'Manage material, size, color, decor, and other labor deltas.' },
      { href: '/settings/shopping/auto-price', title: 'Auto Price', desc: 'Recompute and review target prices.' },
    ],
  },
  {
    title: 'Inspect',
    items: [
      { href: '/settings/shopping/workflow', title: 'Workflow', desc: 'Review the end-to-end operating flow.' },
      { href: '/settings/shopping/sync-jobs', title: 'Sync Jobs', desc: 'Check push failures and retries.' },
      { href: '/settings/shopping/cron-runs', title: 'Cron Runs', desc: 'Review scheduled run history.' },
    ],
  },
  {
    title: 'Configure',
    items: [
      { href: '/settings/shopping/channels', title: 'Channels', desc: 'Manage Cafe24 channel connections.' },
      { href: '/settings/shopping/factors', title: 'Policies and Factors', desc: 'Manage pricing policies and factor sets.' },
    ],
  },
];

export default function ShoppingSettingsHomePage() {
  return (
    <div className='space-y-4'>
      <ActionBar title='Shopping Settings' subtitle='Open the option labor manager, pricing workflow, and sync tools from one place.' />
      {groups.map((group) => (
        <Card key={group.title}>
          <CardHeader title={group.title} />
          <CardBody className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {group.items.map((item) => (
              <div key={item.href} className='rounded-[var(--radius)] border border-[var(--hairline)] p-3'>
                <div className='text-sm font-semibold'>{item.title}</div>
                <p className='mt-1 text-xs text-[var(--muted)]'>{item.desc}</p>
                <div className='mt-3'>
                  <Link href={item.href}>
                    <Button variant='secondary' size='sm'>Open</Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
