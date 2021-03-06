const express = require('express');
const router = express.Router();
const _ = require('lodash');
const cheerio = require('cheerio');
const request = require('request-promise');
const phantom = require('phantom');

const VENDORS = {
  books: {
    name: '博客來',
    queryUrl: _.template(`http://search.books.com.tw/search/query/key/<%= key %>/cat/all`),
    handler: booksHandler
  },
  pchome: {
    name: 'PChome',
    queryUrl: _.template(`http://ecshweb.pchome.com.tw/search/v3.3/all/results?q=<%= key %>&page=1&sort=rnk/dc`),
    handler: pchomeHandler
  },
  yahoo: {
    name: 'Yahoo購物中心',
    queryUrl: _.template(`https://tw.search.buy.yahoo.com/search/shopping/product?p=<%= key %>&qt=product&cid=0&clv=0&cid_path=`),
    handler: yahooHandler
  },
  momo: {
    name: 'MOMO購物網',
    queryUrl: _.template(`https://www.momoshop.com.tw/search/searchShop.jsp?keyword=<%= key %>&searchType=1&curPage=1`),
    handler: momoHandler
  }
};

router.use((req, res, next) => { next(); });

router.get('/list', (req, res) => {
  let promises = _.map(VENDORS, (v, k) => crawl(k, encodeURIComponent(req.query.key)));
  Promise.all(promises)
    .then(results => {
      res.send({
        code: 200,
        msg: 'success',
        items: _.chain(results).flatten().orderBy(['price'], ['asc']).value()
      });
    });
});

function crawl(vid, key) {
  return new Promise((resolve) => {
    let vendor = VENDORS[vid];
    vendor.handler(key).then(items => { resolve(items); });
  });
}

function booksHandler(key) {
  return request(this.queryUrl({key}))
    .then(res => {
      let $ = cheerio.load(res);
      let results = $('.searchbook > .item');
      if (!results.length) return [];

      let items = [];
      results.each((i, elem) => {
        let imgElem = $(elem).children('a[rel="mid_image"]');
        let title = imgElem.attr('title');
        let url = imgElem.attr('href');
        let img = imgElem.children('img').data('original');
        let price = parseInt($(elem).children('.price').children('strong').children('b').last().text());
        items.push({
          title, price, img, url, vendor: this.name
        });
      });
      return items;
    })
    .catch(() => []);
}

function pchomeHandler(key) {
  return request(this.queryUrl({key}))
    .then(res => {
      let results = JSON.parse(res).prods;
      if (!results.length) return [];

      let items = JSON.parse(res).prods.map(item => ({
        title: item.name,
        price: parseInt(item.price),
        img: `//a.ecimg.tw${item.picS}`,
        url: `//24h.pchome.com.tw/prod/${item.Id}`,
        vendor: this.name
      }));
      return items;
    })
    .catch(() => []);
}

function yahooHandler(key) {
  return request(this.queryUrl({key}))
    .then(res => {
      let $ = cheerio.load(res);
      let results = $('#srp_result_list .item');
      if (!results.length) return [];

      let items = [];
      results.each((i, elem) => {
        let aElem = $(elem).children('.wrap').children('.yui3-u').children('.srp-pdimage').children('a');
        let title = aElem.attr('title');
        let url = aElem.attr('href');
        let img = aElem.children('img').attr('src');
        let priceElem = $(elem).children('.wrap').children('.srp-pdtaglist').children('.srp-pdprice');
        let price = parseInt(priceElem.children('.srp-actprice').children('em').text().replace('$', ''));
        if (!price) price = parseInt(priceElem.children('.srp-listprice').children('.srp-listprice-class').text().replace('$', ''));
        items.push({
          title, price, img, url, vendor: this.name
        });
      });
      return items;
    })
    .catch(() => ([]));
}

function momoHandler(key) {;
  let phInstance = null;
  let _page = null;
  return phantom.create()
    .then(instance => {
      phInstance = instance;
      return instance.createPage();
    })
    .then(page => {
      _page = page;
      return page.open(this.queryUrl({key}));
    })
    .then(() => _page.property('content') )
    .then(content => {
      let $ = cheerio.load(content);
      let results = $('.listArea ul li');
      if (!results.length) return [];

      let items = [];
      results.each((i, elem) => {
        let aElem = $(elem).children('.goodsUrl');

        let title = aElem.children('.prdName').text();
        let url = 'https://www.momoshop.com.tw' + aElem.attr('href');
        let img = aElem.children('img').attr('src');
        let price = parseInt(aElem.children('.money').children('.price').children('b').text());

        items.push({
          title, url, img, price, vendor: this.name
        });
      });
      return items;
    })
    .catch(() => {
      phInstance.exit();
      return [];
    });
}

module.exports = router;
