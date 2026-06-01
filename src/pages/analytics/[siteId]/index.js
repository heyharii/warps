import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Ga4Analytics from '@/components/Ga4Analytics';

export default function Analytics() {
  const router = useRouter();
  const { siteId } = router.query;

  return (
    <>
      <Head><title>Analytics — Traffic Source</title></Head>
      <DashboardLayout siteId={siteId}>
        {siteId && <Ga4Analytics siteId={siteId} />}
      </DashboardLayout>
    </>
  );
}
