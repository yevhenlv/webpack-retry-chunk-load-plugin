"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryChunkLoadPlugin = void 0;
const prettier = require("prettier");
const webpack_1 = require("webpack");
const envVariables = require("@englishdom/shared/utils/env-var.json");

const pluginName = 'RetryChunkLoadPlugin';

class RetryChunkLoadPlugin {
    constructor(options = {}) {
        this.options = Object.assign({}, options);
    }
    apply(compiler) {
        compiler.hooks.thisCompilation.tap(pluginName, compilation => {
            const { mainTemplate, runtimeTemplate } = compilation;
            const maxRetryValueFromOptions = Number(this.options.maxRetries);
            const maxRetries = Number.isInteger(maxRetryValueFromOptions) &&
                maxRetryValueFromOptions > 0
                ? maxRetryValueFromOptions
                : 1;
            const getCacheBustString = () => this.options.cacheBust
                ? `
                  (${this.options.cacheBust})();
                `
                : '"cache-bust=true"';
            mainTemplate.hooks.localVars.tap({ name: pluginName, stage: 1 }, (source, chunk) => {
                const currentChunkName = chunk.name;
                const addRetryCode = !this.options.chunks ||
                    this.options.chunks.includes(currentChunkName);
                const getRetryDelay = typeof this.options.retryDelay === 'string'
                    ? this.options.retryDelay
                    : `function() { return ${this.options.retryDelay || 0} }`;
                if (!addRetryCode)
                    return source;
                const script = runtimeTemplate.iife('', `
          if(typeof ${webpack_1.RuntimeGlobals.require} !== "undefined") {
            var oldGetScript = ${webpack_1.RuntimeGlobals.getChunkScriptFilename};
            var oldLoadScript = ${webpack_1.RuntimeGlobals.ensureChunk};
            var queryMap = {};
            var countMap = {};
            var getRetryDelay = ${getRetryDelay}
            ${webpack_1.RuntimeGlobals.getChunkScriptFilename} = function(chunkId){
              var result = oldGetScript(chunkId);
              return result + (queryMap.hasOwnProperty(chunkId) ? '?' + queryMap[chunkId]  : '');
            };
            ${webpack_1.RuntimeGlobals.ensureChunk} = function(chunkId){
              var result = oldLoadScript(chunkId);
              return result.catch(function(error){
                var retries = countMap.hasOwnProperty(chunkId) ? countMap[chunkId] : ${maxRetries};
                if (retries < 1) {
                  var realSrc = oldGetScript(chunkId);
                  error.message = 'Loading chunk ' + chunkId + ' failed after ${maxRetries} retries.\\n(' + realSrc + ')';
                  error.request = realSrc;${this.options.lastResortScript
                    ? this.options.lastResortScript
                    : ''}
                  throw error;
                } else {
                  window.env.publicPathLoaded = false;

                  var links = document.querySelectorAll('link');

                  links.forEach((el) => {
                    if (el.getAttribute('rel') === 'stylesheet') {
                      var cssLink = el.getAttribute('href');
                      var matches = [
                        'wss',
                        'pages/revision',
                        'pages/cdn',
                        'old-browser',
                        'stacktrace',
                      ].filter((excluded) => (cssLink || '').match(excluded)).length;

                      if (matches) return;
                      if (window.env.publicPathLoaded) return;

                      if (cssLink && cssLink.match(/\.css/)) {
                        if (window.env.edLocalHostLoaded) {
                          localStorage.setItem('ed-revision-host', '${envVariables.CDN_HOST}');
                          window.env.CDN_HOST_CONST_PREV = '';
                          window.env.CDN_HOST_CONST = '${envVariables.CDN_HOST}';
                          window.chunkURL = '${envVariables.CDN_HOST}' + '/' + cssLink.replace("https://", "").split("/").slice(1).slice(0, -1).join("/") + '/';
                        } else {
                          window.env.edLocalHostLoaded = true;
                          localStorage.setItem('ed-revision-host', window.location.origin);
                          window.env.CDN_HOST_CONST_PREV = '${envVariables.CDN_HOST}';
                          window.env.CDN_HOST_CONST = '';
                          window.chunkURL = '/' + cssLink.replace("https://", "").split("/").slice(1).slice(0, -1).join("/") + '/';
                        }

                        window.env.publicPathLoaded = true;
                      }
                    }
                  });
                }
                return new Promise(function (resolve) {
                  var retryAttempt = ${maxRetries} - retries + 1;
                  setTimeout(function () {
                    var retryAttemptString = '&retry-attempt=' + retryAttempt;
                    var cacheBust = ${getCacheBustString()} + retryAttemptString;
                    queryMap[chunkId] = cacheBust;
                    countMap[chunkId] = retries - 1;
                    resolve(${webpack_1.RuntimeGlobals.ensureChunk}(chunkId));
                  }, getRetryDelay(retryAttempt))
                })
              });
            };
          }`);
                return (source +
                    prettier.format(script, {
                        trailingComma: 'es5',
                        singleQuote: true,
                        parser: 'babel',
                    }));
            });
        });
    }
}
exports.RetryChunkLoadPlugin = RetryChunkLoadPlugin;
//# sourceMappingURL=index.js.map
