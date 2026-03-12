'use client';

import Link from 'next/link';
import { ActionBar } from '@/components/layout/action-bar';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const groups = [
  {
    title: '운영',
    items: [
      { href: '/settings/shopping/mappings', title: '상품 매핑', desc: '마스터 상품과 쇼핑몰 상품을 먼저 연결합니다.' },
      { href: '/settings/shopping/rules', title: '옵션 공임 규칙', desc: '소재, 사이즈, 색상, 장식, 기타 추가금을 관리합니다.' },
      { href: '/settings/shopping/auto-price', title: '자동 가격', desc: '재계산과 게시 기준 가격 검토를 진행합니다.' },
    ],
  },
  {
    title: '점검',
    items: [
      { href: '/settings/shopping/workflow', title: '운영 흐름', desc: '전체 운영 흐름과 단계별 체크포인트를 확인합니다.' },
      { href: '/settings/shopping/sync-jobs', title: '동기화 작업 로그', desc: 'push 실패, 재시도, 검증 결과를 확인합니다.' },
      { href: '/settings/shopping/cron-runs', title: '자동 실행 이력', desc: '자동 실행(run) 이력을 확인합니다.' },
    ],
  },
  {
    title: '설정',
    items: [
      { href: '/settings/shopping/channels', title: '채널 설정', desc: 'Cafe24 채널 연결과 계정 상태를 관리합니다.' },
      { href: '/settings/shopping/factors', title: '정책 및 팩터', desc: '가격 정책과 팩터 세트를 관리합니다.' },
    ],
  },
];

export default function ShoppingSettingsHomePage() {
  return (
    <div className='space-y-4'>
      <ActionBar title='쇼핑 설정' subtitle='매핑, 가격, 동기화 도구를 한 곳에서 관리합니다.' />
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
                    <Button variant='secondary' size='sm'>열기</Button>
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
