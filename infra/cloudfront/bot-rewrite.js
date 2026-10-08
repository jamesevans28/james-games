// CloudFront Function (runtime cloudfront-js-2.0), viewer-request, on the
// games4james.com distribution's default behaviour.
//
// Link-preview bots and crawlers asking for /games/:id get the static page
// /static-games/:id.html (built by scripts/generate-sitemap.mjs), which carries
// that game's title, description and og:image. Everyone else gets the SPA.
// Attach steps: infra/cloudfront/README.md. Tests: bot-rewrite.test.mjs.

var BOT_UA =
  /facebookexternalhit|facebot|twitterbot|whatsapp|slackbot|discordbot|telegrambot|linkedinbot|googlebot|bingbot|applebot|pinterest|redditbot|embedly|skypeuripreview|iframely/i;
var GAME_PATH = /^\/games\/([a-z0-9-]+)\/?$/;

function handler(event) {
  var request = event.request;
  var header = request.headers["user-agent"];
  var ua = header ? header.value : "";
  var match = request.uri.match(GAME_PATH);
  if (match && BOT_UA.test(ua)) {
    request.uri = "/static-games/" + match[1] + ".html";
  }
  return request;
}
