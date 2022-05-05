import { lazy, Suspense, VFC } from 'react';

// import { Features, InfoTables, Partners, Preview } from '@/components/sections/Home';
import Preview from '@/components/sections/Home/Preview';

import './Home.scss';
import { PriceBotData } from '@/hooks/useFetchPriceBot';


const Home: VFC<{ priceBotData: PriceBotData | null, isLoaded: boolean }> = ({ priceBotData, isLoaded }) => {

  const InfoTables = lazy((): any => import('@/components/sections/Home/Tables'));
  const Features = lazy((): any => import('@/components/sections/Home/Features'));
  const Partners = lazy((): any => import('@/components/sections/Home/Partners'));

  return (
    <div className="home-wrapper">
      <Preview priceBotData={priceBotData} />
      {!isLoaded ?
        <Suspense fallback="">
          <InfoTables />
          <Features />
          <Partners />
        </Suspense>
        : ''}
    </div>
  );
};

export default Home;
