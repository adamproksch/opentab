'use strict';
// Lightweight built-in ad + tracker blocklist (hostname based, plus a few URL patterns).
// Matching walks hostname suffixes, so "x.y.doubleclick.net" matches "doubleclick.net".

const ADS = `
doubleclick.net googlesyndication.com googleadservices.com adservice.google.com pagead2.googlesyndication.com
adsystem.com adnxs.com adsrvr.org advertising.com adform.net adition.com admob.com amazon-adsystem.com
taboola.com outbrain.com revcontent.com mgid.com zemanta.com criteo.com criteo.net casalemedia.com
pubmatic.com rubiconproject.com openx.net openx.com smartadserver.com sharethrough.com triplelift.com
indexww.com 33across.com contextweb.com lijit.com sovrn.com yieldmo.com teads.tv teads.com adcolony.com
inmobi.com mopub.com unity3d.com/ads applovin.com chartboost.com vungle.com ironsrc.com supersonicads.com
popads.net popcash.net propellerads.com exoclick.com juicyads.com trafficjunky.net clickadu.com hilltopads.net
adsterra.com adsterratools.com mediavine.com adthrive.com ezoic.net ezoic.com moatads.com serving-sys.com
bidswitch.net spotxchange.com spotx.tv springserve.com tremorhub.com freewheel.tv innovid.com adroll.com
rlcdn.com bluekai.com demdex.net krxd.net exelator.com tapad.com turn.com mathtag.com media.net
quantserve.com quantcast.com lotame.com crwdcntrl.net everesttech.net eyeota.net agkn.com adsymptotic.com
yahoo-ads.com ads.yahoo.com advertising.yahoo.com gemini.yahoo.com ads.twitter.com ads-twitter.com
ads.linkedin.com ads.pinterest.com ads.tiktok.com business-api.tiktok.com adsafeprotected.com
doubleverify.com integralads.com iasds01.com pixel.adsafeprotected.com flashtalking.com celtra.com
nativeroll.tv richaudience.com seedtag.com smilewanted.com improvedigital.com onetag-sys.com
adzerk.net carbonads.com buysellads.com bsa-ads.com
`;

const TRACKERS = `
google-analytics.com analytics.google.com stats.g.doubleclick.net ssl.google-analytics.com
googletagservices.com
scorecardresearch.com hotjar.com hotjar.io fullstory.com mouseflow.com crazyegg.com luckyorange.com
smartlook.com inspectlet.com clarity.ms mixpanel.com segment.io segment.com amplitude.com heapanalytics.com
kissmetrics.com optimizely.com vwo.com abtasty.com newrelic.com nr-data.net bugsnag.com
connect.facebook.net pixel.facebook.com an.facebook.com analytics.tiktok.com analytics.twitter.com
t.co/i/adsct static.ads-twitter.com px.ads.linkedin.com snap.licdn.com sc-static.net tr.snapchat.com
bat.bing.com ads.bing.com pixel.quantserve.com chartbeat.com chartbeat.net parsely.com parse.ly
comscore.com sitemeter.com statcounter.com histats.com addthis.com sharethis.com
branch.io app.link adjust.com appsflyer.com kochava.com singular.net
hs-analytics.net hs-banner.com hsadspixel.net hubspot.com/__ptq.gif track.hubspot.com
marketo.net mktoresp.com pardot.com eloqua.com omtrdc.net 2o7.net adobedtm.com
cookielaw.org onetrust.com trustarc.com
yandex.ru/metrika mc.yandex.ru top-fwz1.mail.ru counter.yadro.ru
bounceexchange.com bouncex.net cdn.mxpnl.com
webtrends.com tealiumiq.com tiqcdn.com ensighten.com
sentry.io/api/embed
`.replace(/\S+\/\S*/g, ''); // entries with paths are ignored in the host set (kept above for readability)

// Pattern rules (applied to third-party subresources only)
const PATTERNS = [
  /\/ads\/(?:banner|display|js|serve)/i,
  /\/adserver\//i,
  /\/(?:pagead|adframe|adview|adsbygoogle)\b/i,
  /[?&](?:adunit|ad_unit|adslot)=/i,
  /\/(?:analytics|gtag|ga)\.js(?:\?|$)/i,
  /\/(?:pixel|beacon|collect)\.gif(?:\?|$)/i,
  /\/fbevents\.js/i,
  /\/prebid[\w.-]*\.js/i,
];

// Tracking query parameters removed from top-level navigations.
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_eid', 'mc_cid', '_hsenc', '_hsmi',
  'igshid', 'yclid', 'twclid', 'ttclid', 'vero_id', 'wickedid',
];

// Cosmetic filter: hides leftover ad containers.
const COSMETIC_CSS = `
ins.adsbygoogle, .adsbygoogle, [id^="google_ads_"], [id^="div-gpt-ad"], [id^="ad-slot"],
iframe[src*="doubleclick.net"], iframe[src*="googlesyndication.com"], iframe[id^="google_ads_iframe"],
.ad-banner, .ad-container, .ad-wrapper, .advert, .advertisement, .banner-ad, .sponsored-ad,
.taboola, #taboola-below-article-thumbnails, .OUTBRAIN, [data-ad-slot], [data-google-query-id],
.ytp-ad-overlay-container, #masthead-ad, ytd-ad-slot-renderer, ytd-banner-promo-renderer,
ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer, #player-ads
{ display: none !important; }
`;

const set = new Set();
for (const list of [ADS, TRACKERS]) {
  for (const raw of list.split(/\s+/)) {
    const h = raw.trim().toLowerCase();
    if (h && !h.includes('/')) set.add(h);
  }
}

function hostBlocked(hostname) {
  let h = hostname.toLowerCase();
  while (h) {
    if (set.has(h)) return h;
    const i = h.indexOf('.');
    if (i < 0) break;
    h = h.slice(i + 1);
  }
  return null;
}

// Common two-part public suffixes, so "bbc.co.uk" is the site rather than "co.uk"
// (otherwise allowing one .co.uk site would allow all of them).
const TWO_PART = new Set(`
co.uk org.uk ac.uk gov.uk me.uk ltd.uk plc.uk net.uk sch.uk nhs.uk
com.au net.au org.au edu.au gov.au asn.au id.au co.nz org.nz net.nz govt.nz ac.nz
co.jp ne.jp or.jp ac.jp go.jp co.kr or.kr ac.kr com.cn net.cn org.cn gov.cn edu.cn
com.hk org.hk com.tw org.tw com.sg org.sg edu.sg com.my com.ph com.vn co.th co.id co.in net.in org.in ac.in gov.in
com.br net.br org.br gov.br com.ar com.mx org.mx com.co com.pe com.ve com.uy com.ec
co.za org.za gov.za com.ng com.eg co.ke com.tr org.tr gov.tr com.sa com.pk co.il org.il ac.il
com.ua org.ua com.pl net.pl org.pl com.ru org.ru com.es com.pt com.gr co.at or.at
github.io gitlab.io pages.dev workers.dev netlify.app vercel.app herokuapp.com blogspot.com web.app firebaseapp.com azurewebsites.net cloudfront.net
`.split(/\s+/).filter(Boolean));

function registrable(host) {
  const p = String(host || '').toLowerCase().replace(/\.$/, '').split('.');
  if (p.length <= 2 || /^\d+$/.test(p[p.length - 1])) return p.join('.'); // short names and IPv4 addresses stay whole
  return p.slice(TWO_PART.has(p.slice(-2).join('.')) ? -3 : -2).join('.');
}

function stripTracking(urlStr) {
  try {
    const u = new URL(urlStr);
    let changed = false;
    for (const k of TRACKING_PARAMS) {
      if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; }
    }
    return changed ? u.toString() : null;
  } catch { return null; }
}

module.exports = { hostBlocked, registrable, stripTracking, PATTERNS, COSMETIC_CSS, size: () => set.size };
