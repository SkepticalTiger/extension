import { Tabs, Tooltip } from 'antd';
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

import { KEYRING_TYPE } from '@/shared/constant';
import { ITransactionInfo, NetworkType } from '@/shared/types';
import { Card, Column, Content, Footer, Header, Layout, Row, Text } from '@/ui/components';
import AccountSelect from '@/ui/components/AccountSelect';
import { AddressBar } from '@/ui/components/AddressBar';
import { Button } from '@/ui/components/Button';
import { NavTabBar } from '@/ui/components/NavTabBar';
import { NoticePopover } from '@/ui/components/NoticePopover';
import { UpgradePopover } from '@/ui/components/UpgradePopover';
import { getCurrentTab } from '@/ui/features/browser/tabs';
import { useAccountBalance, useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useCurrentKeyring } from '@/ui/state/keyrings/hooks';
import {
  useBlockstreamUrl,
  useNetworkType,
  useSkipVersionCallback,
  useVersionInfo,
  useWalletConfig
} from '@/ui/state/settings/hooks';
import { fontSizes } from '@/ui/theme/font';
import { handleTransactions, useWallet } from '@/ui/utils';

import { accountActions } from '@/ui/state/accounts/reducer';
import { useAppDispatch } from '@/ui/state/hooks';
import { useNavigate } from '../MainRoute';

const $noBreakStyle: CSSProperties = {
  whiteSpace: 'nowrap',
  wordBreak: 'keep-all'
};

export default function WalletTabScreen() {
  const navigate = useNavigate();

  const accountBalance = useAccountBalance();
  const networkType = useNetworkType();
  const isTestNetwork = networkType === NetworkType.Testnet;

  const currentKeyring = useCurrentKeyring();
  const currentAccount = useCurrentAccount();
  const wallet = useWallet();
  const [transactionInfos, setTransactionInfos] = useState<ITransactionInfo[]>([]);
  // const [balanceValue, setBalanceValue] = useState('--');
  // const getCacheBalance = async () => {
  //   if (accountBalance.amount === '0') {
  //     const cacheBalance = await wallet.getAddressCacheBalance(currentAccount.address);
  //     if (cacheBalance && Number(cacheBalance.amount) > 0) {
  //       setBalanceValue(cacheBalance.amount);
  //     } else {
  //       setBalanceValue(accountBalance.amount);
  //     }
  //   } else {
  //     setBalanceValue(accountBalance.amount);
  //   }
  // };
  // useEffect(() => {
  //   getCacheBalance();
  // }, [accountBalance.amount]);
  const balanceValue = useMemo(() => {
    if (accountBalance.amount === '0' && transactionInfos.length === 0) {
      return '--';
    } else {
      return accountBalance.amount;
    }
  }, [accountBalance.amount, transactionInfos]);
  const [connected, setConnected] = useState(false);
  const [rpcStatus, setRpcStatus] = useState(true);
  const [usdValue, setUSDValue] = useState('--');
  const prevRpcStatus = useRef(true);
  const dispatch = useAppDispatch();
  // const assetTabKey = useAssetTabKey();

  const skipVersion = useSkipVersionCallback();

  const walletConfig = useWalletConfig();
  const versionInfo = useVersionInfo();

  const [showSafeNotice, setShowSafeNotice] = useState(false);

  const fetchActivity = async () => {
    fetch(
      `https://api.kaspa.org/addresses/${currentAccount.address}/full-transactions?limit=10&resolve_previous_outpoints=light`
    )
      .then((response) => response.json())
      .then((data) => {
        const trans = handleTransactions(data, currentAccount.address);
        setTransactionInfos(trans);
      })
      .catch((e) => {
        console.log(e);
      });
  };

  useEffect(() => {
    const run = async () => {
      const show = await wallet.getShowSafeNotice();
      setShowSafeNotice(show);

      const activeTab = await getCurrentTab();
      if (!activeTab) return;
      const site = await wallet.getCurrentConnectedSite(activeTab.id);
      if (site) {
        setConnected(site.isConnected);
      }
    };
    run();
  }, []);

  useEffect(() => {
    prevRpcStatus.current = rpcStatus;
  }, [rpcStatus]);

  useEffect(() => {
    const monitorRpcStatus = setInterval(async () => {
      const status = await wallet.getRpcStatus();
      // re-fetch balance if rpc status is false
      if (prevRpcStatus.current == false && status == true) {
        dispatch(accountActions.expireBalance());
        fetchActivity();
        await wallet.subscribeUtxosChanged();
      }
      setRpcStatus(status);
    }, 4000);
    return () => {
      clearInterval(monitorRpcStatus);
    };
  }, []);
  useEffect(() => {
    fetch('https://api.kaspa.org/info/price')
      .then((response) => response.json())
      .then((data) => {
        const price: number = data.price;
        // 0.178
        if (accountBalance.amount === '0') {
          setUSDValue('--');
        } else {
          const value = Number(accountBalance.amount) * price;
          setUSDValue(value.toLocaleString());
        }
      });
  }, [accountBalance.amount]);

  useEffect(() => {
    fetchActivity();
  }, [accountBalance.amount]);

  const tabItems = [
    //   {
    //     key: AssetTabKey.ORDINALS,
    //     label: 'Ordinals',
    //     children: <OrdinalsTab />
    //   },
    //   {
    //     key: AssetTabKey.ATOMICALS,
    //     label: 'Atomicals',
    //     children: checkAddressFlag(currentAccount.flag, AddressFlagType.Is_Enable_Atomicals) ? (
    //       <AtomicalsTab />
    //     ) : (
    //       <AtomicalsFeatureButton />
    //     )
    //   }
    {
      key: 'activity',
      label: 'Activity',
      children: <ActivityTab transactionInfos={transactionInfos} />
    }
  ];

  const blockstreamUrl = useBlockstreamUrl();

  return (
    <Layout>
      <Header
        LeftComponent={
          <Column>
            {connected && (
              <Row
                itemsCenter
                onClick={() => {
                  navigate('ConnectedSitesScreen');
                }}>
                <Text text="·" color="green" size="xxl" />
                <Text text="Dapp Connected" size="xxs" />
              </Row>
            )}
          </Column>
        }
        RightComponent={
          <Card
            preset="style2"
            onClick={() => {
              navigate('SwitchKeyringScreen');
            }}>
            <Text text={currentKeyring.alianName} size="xxs" />
          </Card>
        }
      />
      <Content>
        <Column gap="xl">
          {currentKeyring.type === KEYRING_TYPE.HdKeyring && <AccountSelect />}

          {isTestNetwork && <Text text="Kaspa Testnet activated." color="danger" textCenter />}
          {rpcStatus == false && <Text text="Connecting network..." color="danger" textCenter />}
          {walletConfig.statusMessage && <Text text={walletConfig.statusMessage} color="danger" textCenter />}

          <Tooltip
            placement={'bottom'}
            title={
              <>
                <Row justifyBetween>
                  <span style={$noBreakStyle}>{'Balance'}</span>
                  <span style={$noBreakStyle}>{`$${usdValue}`}</span>
                </Row>
                {/*    <Row justifyBetween>
                  <span style={$noBreakStyle}>{'Confirmed KAS'}</span>
                  <span style={$noBreakStyle}>{` ${accountBalance.confirm_btc_amount} KAS`}</span>
                </Row>
                <Row justifyBetween>
                  <span style={$noBreakStyle}>{'Unconfirmed KAS'}</span>
                  <span style={$noBreakStyle}>{` ${accountBalance.pending_btc_amount} KAS`}</span>
                </Row>
                <Row justifyBetween>
                  <span style={$noBreakStyle}>{'BTC in Inscriptions'}</span>
                  <span style={$noBreakStyle}>{` ${accountBalance.inscription_amount} BTC`}</span>
                </Row> */}
              </>
            }
            overlayStyle={{
              fontSize: fontSizes.xs
            }}>
            <div>
              <Text text={balanceValue + '  KAS'} preset="title-bold" textCenter size="xxxl" />
            </div>
          </Tooltip>

          <Row itemsCenter justifyCenter>
            <AddressBar />
            {/* <Row
              style={{ marginLeft: 8 }}
              itemsCenter
              onClick={() => {
                window.open(`${blockstreamUrl}/address/${currentAccount.address}`);
              }}>
              <Text text={'View History'} size="xs" />
              <Icon icon="link" size={fontSizes.xs} />
            </Row> */}
          </Row>

          <Row justifyBetween>
            <Button
              text="Receive"
              preset="default"
              icon="receive"
              onClick={(e) => {
                navigate('ReceiveScreen');
              }}
              full
            />

            <Button
              text="Send"
              preset="default"
              icon="send"
              onClick={(e) => {
                navigate('TxCreateScreen');
              }}
              full
            />
            {walletConfig.moonPayEnabled && (
              <Button
                text="Buy"
                preset="default"
                icon="bitcoin"
                onClick={(e) => {
                  navigate('MoonPayScreen');
                }}
                full
              />
            )}
          </Row>

          {/* <Tabs
            size={'small'}
            defaultActiveKey={assetTabKey as unknown as string}
            activeKey={assetTabKey as unknown as string}
            items={tabItems as unknown as any[]}
            onTabClick={(key) => {
              dispatch(uiActions.updateAssetTabScreen({ assetTabKey: key as unknown as AssetTabKey }));
            }}
          /> */}
          {/*{tabItems[assetTabKey].children}*/}
          <Tabs
            size={'small'}
            defaultActiveKey="0"
            // activeKey={assetTabKey as unknown as string}
            items={tabItems as unknown as any[]}
            onTabClick={(key) => {
              // console.log(key);
            }}
          />
        </Column>
        {showSafeNotice && (
          <NoticePopover
            onClose={() => {
              wallet.setShowSafeNotice(false);
              setShowSafeNotice(false);
            }}
          />
        )}
        {!versionInfo.skipped && (
          <UpgradePopover
            onClose={() => {
              skipVersion(versionInfo.newVersion);
            }}
          />
        )}
      </Content>
      <Footer px="zero" py="zero">
        <NavTabBar tab="home" />
      </Footer>
    </Layout>
  );
}
function ActivityTab({ transactionInfos }: { transactionInfos: ITransactionInfo[] }) {
  const navigate = useNavigate();
  if (transactionInfos && transactionInfos.length > 0) {
    return (
      <div>
        {transactionInfos.map((e) => (
          <Card
            key={e.transaction_id}
            classname="card-select"
            mt="md"
            onClick={(event) => {
              navigate('TxDetailScreen', { txDetail: e.txDetail, txId: e.transaction_id });
            }}>
            <Row full justifyBetween>
              <Column full>
                <Row justifyBetween>
                  <Text text={e.mode} />
                  <Text text={e.isConfirmed ? 'confirmed' : 'unconfirmed'} preset="sub" />
                </Row>
                <Row justifyBetween>
                  <Row>
                    <Text text={e.mode == 'receive' ? '+' : '-'} color={e.mode == 'receive' ? 'green' : 'red'} />
                    <Text text={`${e.amount} kas`} />
                  </Row>
                  <Text text={new Date(e.block_time).toLocaleString()} preset="sub" />
                </Row>
              </Column>
            </Row>
          </Card>
        ))}
      </div>
    );
  } else {
    return (
      <Row justifyCenter>
        <Text text="No data" mt="md" />
      </Row>
    );
  }
}

// function OrdinalsTab() {
//   const addressSummary = useAddressSummary();
//   const tabItems = [
//     {
//       key: OrdinalsAssetTabKey.ALL,
//       label: `ALL (${addressSummary.inscriptionCount})`,
//       children: <InscriptionList />
//     },
//     {
//       key: OrdinalsAssetTabKey.BRC20,
//       label: `BRC-20 (${addressSummary.brc20Count})`,
//       children: <BRC20List />
//     }
//   ];

//   const tabKey = useOrdinalsAssetTabKey();
//   const dispatch = useAppDispatch();
//   return (
//     <Column>
//       <Row justifyBetween>
//         <TabBar
//           defaultActiveKey={tabKey}
//           activeKey={tabKey}
//           items={tabItems}
//           preset="style2"
//           onTabClick={(key) => {
//             dispatch(uiActions.updateAssetTabScreen({ ordinalsAssetTabKey: key }));
//           }}
//         />
//       </Row>

//       {tabItems[tabKey].children}
//     </Column>
//   );
// }

// function AtomicalsTab() {
//   const addressSummary = useAddressSummary();
//   const tabItems = [
//     {
//       key: AtomicalsAssetTabKey.ALL,
//       label: `ALL (${addressSummary.atomicalsCount})`,
//       children: <AtomicalList />,
//       hidden: true
//     },
//     {
//       key: AtomicalsAssetTabKey.ARC20,
//       label: `ARC-20 (${addressSummary.arc20Count})`,
//       children: <Arc20List />
//     },
//     {
//       key: AtomicalsAssetTabKey.OTHERS,
//       label: 'Others',
//       children: (
//         <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
//           <Empty text="Not supported yet" />
//         </Column>
//       )
//     }
//   ];

//   const tabKey = useAtomicalsAssetTabKey();
//   const dispatch = useAppDispatch();

//   return (
//     <Column>
//       {!addressSummary.loading && addressSummary.atomicalsCount === 0 && addressSummary.arc20Count === 0 && (
//         <AtomicalsFeatureButton />
//       )}
//       <Row justifyBetween>
//         <TabBar
//           defaultActiveKey={tabKey}
//           activeKey={tabKey}
//           items={tabItems}
//           preset="style2"
//           onTabClick={(key) => {
//             dispatch(uiActions.updateAssetTabScreen({ atomicalsAssetTabKey: key }));
//           }}
//         />
//       </Row>

//       {tabItems[tabKey].children}
//     </Column>
//   );
// }

// function InscriptionList() {
//   const navigate = useNavigate();
//   const wallet = useWallet();
//   const currentAccount = useCurrentAccount();

//   const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
//   const [total, setTotal] = useState(-1);
//   const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 100 });

//   const tools = useTools();

//   const fetchData = async () => {
//     try {
//       // tools.showLoading(true);
//       const { list, total } = await wallet.getOrdinalsInscriptions(
//         currentAccount.address,
//         pagination.currentPage,
//         pagination.pageSize
//       );
//       setInscriptions(list);
//       setTotal(total);
//     } catch (e) {
//       tools.toastError((e as Error).message);
//     } finally {
//       // tools.showLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchData();
//   }, [pagination]);

//   if (total === -1) {
//     return (
//       <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
//         <LoadingOutlined />
//       </Column>
//     );
//   }

//   if (total === 0) {
//     return (
//       <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
//         <Empty text="Empty" />
//       </Column>
//     );
//   }

//   return (
//     <Column>
//       <Row style={{ flexWrap: 'wrap' }} gap="lg">
//         {inscriptions.map((data, index) => (
//           <InscriptionPreview
//             key={index}
//             data={data}
//             preset="medium"
//             onClick={() => {
//               navigate('OrdinalsInscriptionScreen', { inscription: data, withSend: true });
//             }}
//           />
//         ))}
//       </Row>
//       <Row justifyCenter mt="lg">
//         <Pagination
//           pagination={pagination}
//           total={total}
//           onChange={(pagination) => {
//             setPagination(pagination);
//           }}
//         />
//       </Row>
//     </Column>
//   );
// }

// function BRC20List() {
//   const navigate = useNavigate();
//   const wallet = useWallet();
//   const currentAccount = useCurrentAccount();

//   const [tokens, setTokens] = useState<TokenBalance[]>([]);
//   const [total, setTotal] = useState(-1);
//   const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 100 });

//   const tools = useTools();
//   const fetchData = async () => {
//     try {
//       // tools.showLoading(true);
//       const { list, total } = await wallet.getBRC20List(
//         currentAccount.address,
//         pagination.currentPage,
//         pagination.pageSize
//       );
//       setTokens(list);
//       setTotal(total);
//     } catch (e) {
//       tools.toastError((e as Error).message);
//     } finally {
//       // tools.showLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchData();
//   }, [pagination]);

//   if (total === -1) {
//     return (
//       <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
//         <LoadingOutlined />
//       </Column>
//     );
//   }

//   if (total === 0) {
//     return (
//       <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
//         <Empty text="Empty" />
//       </Column>
//     );
//   }

//   return (
//     <Column>
//       <Row style={{ flexWrap: 'wrap' }} gap="sm">
//         {tokens.map((data, index) => (
//           <BRC20BalanceCard
//             key={index}
//             tokenBalance={data}
//             onClick={() => {
//               navigate('BRC20TokenScreen', { tokenBalance: data, ticker: data.ticker });
//             }}
//           />
//         ))}
//       </Row>

//       <Row justifyCenter mt="lg">
//         <Pagination
//           pagination={pagination}
//           total={total}
//           onChange={(pagination) => {
//             setPagination(pagination);
//           }}
//         />
//       </Row>
//     </Column>
//   );
// }

// function AtomicalList() {
//   const navigate = useNavigate();
//   const wallet = useWallet();
//   const currentAccount = useCurrentAccount();

//   const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
//   const [total, setTotal] = useState(-1);
//   const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 100 });

//   const tools = useTools();

//   const fetchData = async () => {
//     try {
//       // tools.showLoading(true);
//       const { list, total } = await wallet.getAtomicalsNFTs(
//         currentAccount.address,
//         pagination.currentPage,
//         pagination.pageSize
//       );
//       setInscriptions(list);
//       setTotal(total);
//     } catch (e) {
//       tools.toastError((e as Error).message);
//     } finally {
//       // tools.showLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchData();
//   }, [pagination]);

//   if (total === -1) {
//     return (
//       <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
//         <LoadingOutlined />
//       </Column>
//     );
//   }

//   if (total === 0) {
//     return (
//       <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
//         <Empty text="Empty" />
//       </Column>
//     );
//   }

//   return (
//     <Column>
//       <Row style={{ flexWrap: 'wrap' }} gap="lg">
//         {inscriptions.map((data, index) => (
//           <InscriptionPreview
//             key={index}
//             data={data}
//             preset="medium"
//             onClick={() => {
//               navigate('AtomicalsInscriptionScreen', { inscription: data, withSend: true });
//             }}
//           />
//         ))}
//       </Row>
//       <Row justifyCenter mt="lg">
//         <Pagination
//           pagination={pagination}
//           total={total}
//           onChange={(pagination) => {
//             setPagination(pagination);
//           }}
//         />
//       </Row>
//     </Column>
//   );
// }

// function Arc20List() {
//   const navigate = useNavigate();
//   const wallet = useWallet();
//   const currentAccount = useCurrentAccount();

//   const [arc20Balances, setArc20Balances] = useState<Arc20Balance[]>([]);
//   const [total, setTotal] = useState(-1);
//   const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 100 });

//   const tools = useTools();
//   const fetchData = async () => {
//     try {
//       // tools.showLoading(true);
//       const { list, total } = await wallet.getArc20BalanceList(
//         currentAccount.address,
//         pagination.currentPage,
//         pagination.pageSize
//       );
//       setArc20Balances(list);
//       setTotal(total);
//     } catch (e) {
//       tools.toastError((e as Error).message);
//     } finally {
//       // tools.showLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchData();
//   }, [pagination]);

//   if (total === -1) {
//     return (
//       <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
//         <LoadingOutlined />
//       </Column>
//     );
//   }

//   if (total === 0) {
//     return (
//       <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
//         <Empty text="Empty" />
//       </Column>
//     );
//   }

//   return (
//     <Column>
//       <Row style={{ flexWrap: 'wrap' }} gap="sm">
//         {arc20Balances.map((data, index) => (
//           <Arc20BalanceCard
//             key={index}
//             arc20Balance={data}
//             onClick={() => {
//               navigate('SendArc20Screen', { arc20Balance: data });
//             }}
//           />
//         ))}
//       </Row>

//       <Row justifyCenter mt="lg">
//         <Pagination
//           pagination={pagination}
//           total={total}
//           onChange={(pagination) => {
//             setPagination(pagination);
//           }}
//         />
//       </Row>
//     </Column>
//   );
// }