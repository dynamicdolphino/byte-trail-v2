// Platform layer. Every platform call in the game goes through this module.
// Mode comes from <meta name="byte-trail-platform"> (written by tools/zip.py) or ?platform=, default "web".
const MODE = document.querySelector('meta[name="byte-trail-platform"]')?.content
  || new URLSearchParams(location.search).get('platform') || 'web';
const KEY = 'byte-trail-v2';
const noop = () => {};
const resolved = async () => {};

// The Page Visibility API is never used in playables mode, even without the SDK.
const onVisibility = hidden => cb => {
  if (MODE === 'playables') return;
  document.addEventListener('visibilitychange', () => { if (document.hidden === hidden) cb(); });
};

const web = {
  init: resolved,
  firstFrameReady: noop,
  gameReady: noop,
  onPause: onVisibility(true),
  onResume: onVisibility(false),
  isAudioEnabled: () => true,
  onAudioChange: noop,
  load: async () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  save: async s => { try { localStorage.setItem(KEY, s); } catch { /* storage blocked: progress stays in memory */ } },
  sendScore: noop,
  showRewarded: async () => true, // no ad network on the open web, so rewards are free
  showInterstitial: resolved,
  gameplayStart: noop,
  gameplayStop: noop,
};

// YouTube Playables (ytgame SDK, loaded by a script tag before the game).
const playables = yt => ({
  ...web,
  firstFrameReady: () => yt.game.firstFrameReady(),
  gameReady: () => yt.game.gameReady(),
  onPause: cb => yt.system.onPause(cb),
  onResume: cb => yt.system.onResume(cb),
  isAudioEnabled: () => yt.system.isAudioEnabled(),
  onAudioChange: cb => yt.system.onAudioEnabledChange(cb),
  load: () => yt.game.loadData().catch(() => null),
  save: s => yt.game.saveData(s).catch(noop),
  sendScore: n => yt.engagement.sendScore({ value: n }).catch(noop),
  showRewarded: id => yt.ads.requestRewardedAd(id).catch(() => false),
  showInterstitial: () => yt.ads.requestInterstitialAd().catch(noop),
});

// Poki SDK v2 stub.
const poki = sdk => ({
  ...web,
  init: () => sdk.init().catch(noop),
  gameReady: () => sdk.gameLoadingFinished(),
  gameplayStart: () => sdk.gameplayStart(),
  gameplayStop: () => sdk.gameplayStop(),
  showRewarded: () => sdk.rewardedBreak().catch(() => false),
  showInterstitial: () => sdk.commercialBreak().catch(noop),
});

// CrazyGames SDK v3 stub.
const crazygames = sdk => {
  const ad = type => new Promise(done => sdk.ad.requestAd(type, { adFinished: () => done(true), adError: () => done(false) }));
  return {
    ...web,
    init: async () => { await sdk.init().catch(noop); sdk.game.loadingStart(); },
    gameReady: () => sdk.game.loadingStop(),
    gameplayStart: () => sdk.game.gameplayStart(),
    gameplayStop: () => sdk.game.gameplayStop(),
    showRewarded: () => ad('rewarded'),
    showInterstitial: () => ad('midgame'),
  };
};

const impl =
  MODE === 'playables' && window.ytgame ? playables(window.ytgame) :
  MODE === 'poki' && window.PokiSDK ? poki(window.PokiSDK) :
  MODE === 'crazygames' && window.CrazyGames?.SDK ? crazygames(window.CrazyGames.SDK) :
  web;

// Rewarded and interstitial ads exist only when a platform SDK is active.
export const hasAds = impl !== web;

export const {
  init, firstFrameReady, gameReady, onPause, onResume, isAudioEnabled, onAudioChange,
  load, save, sendScore, showRewarded, showInterstitial, gameplayStart, gameplayStop,
} = impl;
