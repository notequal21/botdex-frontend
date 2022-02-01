import React from 'react';

import TableRow from '@/components/sections/Farms/TableRow';
import { Farm } from '@/types';

import './Table.scss';

interface ITableProps {
  data: Farm[];
}

const Table: React.FC<ITableProps> = React.memo(({ data }) => {
  return (
    <div className="farms-table box-overflow-v">
      <div className="farms-table__head t-box-none">
        <div />
        <div className="text-ssm text-gray-2">Earned</div>
        <div className="text-bold farms-table--apr">APR</div>
        <div className="text-bold farms-table--liquidity">Liquidity</div>
        <div className="text-bold farms-table--multiplier">Multiplier</div>
      </div>

      {data.map((farm) => {
        return <TableRow key={farm.pid} farm={farm} />;
      })}
    </div>
  );
});

export default Table;
