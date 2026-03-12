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
    title: '1) 채널 연결',
    why: '가격 동기화 전에 Cafe24 채널 인증 상태를 확인합니다.',
    uiPath: '/settings/shopping/channels',
    apis: ['/api/channels', '/api/channels/[id]/account', '/api/shop-oauth/cafe24/authorize', '/api/shop-oauth/cafe24/callback'],
    checklist: ['채널 활성', 'OAuth 완료', '토큰 저장 확인'],
  },
  {
    title: '2) 상품 매핑',
    why: '가격 계산 전에 마스터 상품과 쇼핑몰 상품을 연결합니다.',
    uiPath: '/settings/shopping/mappings',
    apis: ['/api/channel-products', '/api/channel-products/[id]', '/api/channel-products/bulk', '/api/channel-products/variants'],
    checklist: ['base 매핑 누락 없음', '활성 variant 중복 없음', '옵션 구조 확인'],
  },
  {
    title: '3) 정책 및 팩터',
    why: '가격 정책과 팩터 세트가 기본 계산 방식을 결정합니다.',
    uiPath: '/settings/shopping/factors',
    apis: ['/api/pricing-policies', '/api/material-factor-sets', '/api/material-factor-config'],
    checklist: ['활성 정책 1개', '반올림 확인', '팩터 세트 연결'],
  },
  {
    title: '4) 옵션 공임 규칙',
    why: '소재, 사이즈, 색상, 장식, 기타 기준의 옵션 추가금을 관리합니다.',
    uiPath: '/settings/shopping/rules',
    apis: ['/api/option-labor-rules', '/api/option-labor-rule-pools', '/api/channel-labor-price-adjustments', '/api/sync-rules/preview'],
    checklist: ['대상 선택', '카테고리 추가금 저장', '조정 로그 확인'],
  },
  {
    title: '5) 자동 가격 실행',
    why: '규칙 변경 후 재계산하고 게시 기준 가격을 push합니다.',
    uiPath: '/settings/shopping/auto-price',
    apis: ['/api/pricing/recompute', '/api/price-sync-runs-v2', '/api/price-sync-runs-v2/[run_id]/execute'],
    checklist: ['publish version 생성', 'run 생성', '실행 결과 확인'],
  },
];

export default function ShoppingWorkflowPage() {
  return (
    <div className='space-y-4'>
      {steps.map((step) => (
        <Card key={step.title}>
          <CardHeader title={step.title} description={step.why} />
          <CardBody className='space-y-3'>
            <div className='text-sm text-[var(--muted)]'>화면: {step.uiPath}</div>
            <div className='flex gap-2'><Link href={step.uiPath}><Button variant='secondary' size='sm'>화면 열기</Button></Link></div>
            <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
              <div className='rounded-[var(--radius)] border border-[var(--hairline)] p-3'>
                <div className='mb-2 text-sm font-semibold'>API</div>
                <div className='space-y-2 text-xs'>{step.apis.map((api) => <div key={api}><code>{api}</code></div>)}</div>
              </div>
              <div className='rounded-[var(--radius)] border border-[var(--hairline)] p-3'>
                <div className='mb-2 text-sm font-semibold'>체크리스트</div>
                <div className='space-y-2 text-xs'>{step.checklist.map((item) => <div key={item}>{item}</div>)}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
