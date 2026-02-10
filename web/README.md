This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## New Receipt Matching Manual Checklist

- [ ] 헤더 저장 필요 상태에서 드로어 열기 -> 상단 배너의 `헤더 저장` CTA로 저장 후 자동 제안 확인
- [ ] 라인 dirty 상태에서 드로어 열기 -> 상단 배너의 `라인 저장` CTA로 저장 후 확정 성공
- [ ] 허용 범위를 벗어난 중량 입력 -> 경고 문구 표시 + 확정 버튼 비활성화
- [ ] 확정 성공 후 Success 배너 표시 -> `Next Unmatched Line`으로 다음 라인 이동
- [ ] 후보 없음 상태에서도 드로어 레이아웃/버튼 영역이 깨지지 않음
