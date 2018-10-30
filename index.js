/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const blessed = require('blessed');
const zibar = require('zibar');

let msg = null;
var aggregators = {
  last(x) { return x.slice(-1)[0]; },
  sum(x) { return Array.prototype.slice.call(x).reduce((a, b) => a + b); },
  avg(x) { return aggregators.sum(x) / x.length; },
  max(x) { return Math.max.apply(null, x); },
  min(x) { return Math.min.apply(null, x); },
  count(x) { return x.length; },
  growth(x, context) {
    const value = aggregators.last(x);
    const previous = context.previous !== undefined ? context.previous : value;
    const diff = value - previous;
    const result = Math.max(diff,0);
    context.previous = value;
    return result;
  }
};

const turtle = function(config) {
  let container, format, interval, screen;
  if (config != null ? config.container : undefined) {
    ({ screen } = config.container);
    ({ container } = config);
  } else {
    screen = blessed.screen({
      smartCSR: true,
      forceUnicode: true,
      input: config.input
    });
    msg = blessed.box({
      height: 3,
      bottom: 0,
      padding: 1,
      parent: screen
    });
    container = blessed.box({
      padding: 1,
      parent: screen
    });
  }
  const colors = [ 'yellow', 'green', 'magenta', 'white'];
  let pos=0;
  let length=0;
  let scroll=pos;
  const series = {};
  const styles = {};
  const accumulators = {};
  const contexts = {};
  let t0=0;
  let now=0;
  const graphers = {};
  const contents = [];
  let start = 0;
  if (config != null ? config.seconds : undefined) {
    format = x => Math.ceil(x);
    interval = 5;
  } else {
    format = function(x) {
      const m = /(\d{2}:\d{2}:)(\d{2})/.exec(new Date(x*1000).toTimeString());
      return m[1].black.bold+m[2].cyan;
    };
    interval = 10;
  }
  const refresh = function() {
    for (let title in series) {
      const serie = series[title];
      for (let subTitle in serie) {
        const sub = serie[subTitle];
        graphers[title][subTitle](sub, styles[title] != null ? styles[title][subTitle] : undefined);
      }
    }
    return screen.render();
  };
  let graphWidth=0;
  let layingOut=false;
  const layout = function() {
    let serie, subTitle;
    layingOut = true;
    for (let content of Array.from(contents)) {
      content.destroy();
    }
    contents.splice(0);
    let top = 0;
    const offset = 0;
    let titleWidth = 0;
    let graphCount = 0;
    for (var title in series) {
      serie = series[title];
      titleWidth = Math.max(title.length+1, titleWidth);
      for (subTitle in serie) {
        titleWidth = Math.max(subTitle.length+1, titleWidth);
        graphCount++;
      }
    }
    container.height = screen.height - (msg ? msg.height : 0);
    const maxGraphHeight = Math.floor(container.height / graphCount);
    const graphHeight = Math.min(maxGraphHeight, (config != null ? config.maxGraphHeight : undefined) || 8);
    // NOTE: original graph width took the title width into account
    // graphWidth = Math.max((container.width-titleWidth)+1, 10);
    graphWidth = Math.max(container.width+1, 10);
    return (() => {
      const result = [];
      for (title in series) {
        serie = series[title];
        const lane = blessed.box({
          parent: container,
          width: '100%',
          height: graphHeight * Object.keys(serie).length,
          top
        });
        blessed.box({
          tags: true,
          parent: lane,
          content: `{bold}{white-fg}${title}`
        });
        contents.push(lane);
        let index = 0;
        graphers[title] = {};
        for (subTitle in serie) {
          const sub = serie[subTitle];
          blessed.box({
            tags: true,
            parent: lane,
            top: (index * graphHeight)+1,
            content: ` {white-fg}${subTitle}`
          });
          const graph = blessed.box({
            parent: lane,
            top: index * graphHeight + 2,
            left: 0,
            // TODO: handle lots of graphs with vertical scrolling content
            // NOTE: below is the original implementation,
            //       it seems to display things in a single value mode
            // top: index * graphHeight,
            // left: titleWidth,
            height: graphHeight,
            bottom: 1
          });
          const grapher = (graphers[title][subTitle] = ((graph,index,subTitle) => function(s, style) {
            length = graphWidth-10-interval;
            if (s.length <= length) {
              scroll = pos;
            } else {
              if (scroll >= (pos - 1)) { scroll = pos; }
            }
            start = Math.max((scroll-length)+1,0);
            s = s.slice(start, start + Math.max(length, 0));
            style = {
              marks: __guard__(style != null ? style.marks : undefined, x => x.slice(start, start + Math.max(length, 0))),
              colors: __guard__(style != null ? style.colors : undefined, x1 => x1.slice(start, start + Math.max(length, 0))),
              vlines: __guard__(style != null ? style.vlines : undefined, x2 => x2.slice(start, start + Math.max(length, 0)))
            };
            const factor = (now-t0)/1000/pos;
            const conf = __guard__(config != null ? config.metrics : undefined, x3 => x3[subTitle]);
            return graph.setContent(zibar(s, {
              color: (conf != null ? conf.color : undefined) || colors[index % colors.length],
              height: (conf != null ? conf.height : undefined) || (graph.height-3),
              chars: (conf != null ? conf.chars : undefined),
              yAxis: (conf != null ? conf.yAxis : undefined),
              marks: style.marks,
              colors: style.colors,
              vlines: style.vlines,
              min: (conf != null ? conf.min : undefined),
              max: (conf != null ? conf.max : undefined),
              high: (conf != null ? conf.high : undefined),
              low: (conf != null ? conf.low : undefined),
              xAxis: {
                display: __guard__(conf != null ? conf.xAxis : undefined, x4 => x4.display) !== undefined ? __guard__(conf != null ? conf.xAxis : undefined, x5 => x5.display) : true,
                factor,
                color: __guard__(conf != null ? conf.xAxis : undefined, x6 => x6.color),
                interval: __guard__(conf != null ? conf.xAxis : undefined, x7 => x7.interval) || interval,
                origin: (start * factor) + (!(config != null ? config.seconds : undefined) ? (t0/1000) + (6*factor) : 0),
                offset: -start - (!(config != null ? config.seconds : undefined) ? 6 : 0),
                format: __guard__(conf != null ? conf.xAxis : undefined, x8 => x8.format) || format
              }
            }
            )
            );
          } )(graph, index, subTitle));
          grapher(sub, styles[title] != null ? styles[title][subTitle] : undefined);
          index++;
          top += graphHeight;
        }
        container.focus();
        screen.render();
        result.push(layingOut = false);
      }
      return result;
    })();
  };
  container.on('resize', function() {
    if (!layingOut) { return layout(); }
  });
  layout();
  const tryScroll = function(s) {
    if (pos > length) {
      scroll = s;
      return refresh();
    }
  };
  screen.key(['q', 'C-c'], () => process.exit());
  screen.key('left', () => tryScroll(Math.max(length-1, scroll-10)));
  screen.key('right', () => tryScroll(scroll+10));
  screen.key('home', () => tryScroll(length-1));
  screen.key('end', () => tryScroll(pos));
  const api = {};
  let started = false;
  api.start = function() {
    if (!started) {
      t0 = Date.now();
      setInterval(function() {
        now = Date.now();
        pos++;
        for (let title in accumulators) {
          const acc = accumulators[title];
          for (var subTitle in acc) {
            var value;
            const sub = acc[subTitle];
            series[title] = series[title] || {};
            const serie = (series[title][subTitle] = series[title][subTitle] || []);
            contexts[title] = contexts[title] || {};
            const context = (contexts[title][subTitle] = contexts[title][subTitle] || {});
            const last = __guard__(series[title][subTitle].slice(-1), x => x[0]) || 0;
            if (sub.length) {
              let agg = __guard__(__guard__(config != null ? config.metrics : undefined, x2 => x2[subTitle]), x1 => x1.aggregator);
              if (!(agg != null ? agg.apply : undefined)) { agg = aggregators[agg]; }
              agg = agg || aggregators.avg;
              value = agg(sub, context);
            } else {
              value = (config != null ? config.keep : undefined) || __guard__(__guard__(config != null ? config.metrics : undefined, x4 => x4[subTitle]), x3 => x3.keep) ? last : 0;
            }
            if (!serie.length && (pos > 1)) {
              for (let i = 0, end = pos-1, asc = 0 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
                serie.push(0);
              }
            }
            serie.push(value);
            sub.splice(0);
            if (!(graphers[title] != null ? graphers[title][subTitle] : undefined)) { layout(); }
            graphers[title][subTitle](serie, styles[title] != null ? styles[title][subTitle] : undefined);
          }
        }
        return screen.render();
      }
      , (config != null ? config.interval : undefined) || 1000);
      started = true;
      return api;
    }
  };
  api.metric = function(one, two) {
    const group = two ? one : '';
    const name = two ? two : one;
    accumulators[group] = accumulators[group] || {};
    const acc = (accumulators[group][name] = accumulators[group][name] || []);
    styles[group] = styles[group] || {};
    const style = (styles[group][name] = styles[group][name] ||{
      marks:  [],
      colors: [],
      vlines: []
    });
    if (!(graphers[group] != null ? graphers[group][name] : undefined)) { layout(); }
    return (function(acc, style) {
      let result = {};
      result = {
        push(value) {
          acc.push(value);
          return result;
        },
        mark(value) {
          style.marks[pos] = value;
          return result;
        },
        color(value) {
          style.colors[pos] = value;
          return result;
        },
        vline(value) {
          style.vlines[pos] = value;
          return result;
        }
      };
      return result;
    })(acc, style);
  };
  api.message = function(line) {
    if (msg) { return msg.setContent(line); }
  };
  if (!(config != null ? config.noAutoStart : undefined)) { api.start(); }
  return api;
};

module.exports = turtle;

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
