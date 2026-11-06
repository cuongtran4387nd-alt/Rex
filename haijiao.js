WidgetMetadata = {
  id: "user.haijiao",
  title: "海角社区",
  description: "海角社区 · 影视/短视频资源",
  author: "YG",
  version: "2.3.0",
  requiredVersion: "0.0.1",
  detailCacheDuration: 30,
  search: {
    title: "搜索海角",
    functionName: "searchVideos",
    params: [{ name: "keyword", title: "关键词", type: "input", value: "" }]
  },
  modules: [
    {
      id: "haijiao-resource",
      title: "播放资源",
      description: "解析海角播放地址",
      requiresWebView: false,
      cacheDuration: 0,
      functionName: "loadResource",
      type: "stream",
      params: [
        { name: "link", title: "详情链接", type: "input", value: "" },
        { name: "title", title: "标题", type: "input", value: "" }
      ]
    },
    {
      id: "haijiao-latest",
      title: "最新视频",
      description: "海角最新上传视频",
      requiresWebView: false,
      cacheDuration: 120,
      functionName: "loadList",
      params: [
        { name: "kind", title: "类型", type: "constant", value: "latest" },
        { name: "page", title: "页码", type: "page" }
      ]
    },
    {
      id: "haijiao-hot",
      title: "热门视频",
      description: "海角热门榜单",
      requiresWebView: false,
      cacheDuration: 120,
      functionName: "loadList",
      params: [
        { name: "kind", title: "类型", type: "constant", value: "hot" },
        { name: "page", title: "页码", type: "page" }
      ]
    }
  ]
};

function clean(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pick() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function withImages(item, url) {
  if (!url) return item;
  item.coverUrl = url; item.posterUrl = url; item.posterURL = url;
  item.poster_url = url; item.posterPath = url; item.poster_path = url;
  item.detailPoster = url; item.detailPosterUrl = url;
  return item;
}

var API_HOST = "https://haijiao.com";
var UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

function buildHeaders() {
  return {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Referer": API_HOST + "/"
  };
}

function formatArticleItem(a) {
  var id = String(a.id || a.topicId || a.code || "");
  var title = clean(pick(a.title, a.subject, a.name, "海角视频 #" + id));
  var cover = pick(a.cover, a.coverUrl, a.thumb, a.pic, a.image);
  
  var bits = [];
  if (a.author || a.userName) bits.push(clean(pick(a.author, a.userName)));
  if (a.createdAt || a.created_at) bits.push(String(pick(a.createdAt, a.created_at)).slice(0, 10));
  if (a.views || a.viewCount) bits.push("观看 " + pick(a.views, a.viewCount));

  var item = {
    id: id,
    type: "detail",
    mediaType: "movie",
    title: title,
    link: "haijiao://a/" + id,
    description: bits.join(" · "),
    overview: clean(pick(a.summary, a.description, a.content, ""))
  };

  return withImages(item, cover);
}

async function loadList(params) {
  var kind = (params && params.kind) || "latest";
  var page = Math.max(1, parseInt((params && params.page) || 1, 10) || 1);
  var size = 24;

  var path = (kind === "hot") ? "/api/v1/topic/hot" : "/api/v1/topic/latest";
  var url = API_HOST + path + "?page=" + page + "&size=" + size;

  try {
    var resp = await Widget.http.get(url, { headers: buildHeaders() });
    var json = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
    var list = (json && (json.data || json.list || json.items)) || [];
    
    var out = [];
    for (var i = 0; i < list.length; i++) {
      out.push(formatArticleItem(list[i]));
    }
    return out;
  } catch (e) {
    return [];
  }
}

async function searchVideos(params) {
  var keyword = clean((params && (params.keyword || params.q)) || "");
  if (!keyword) return [];
  var page = Math.max(1, parseInt((params && params.page) || 1, 10) || 1);

  var url = API_HOST + "/api/v1/topic/search?keyword=" + encodeURIComponent(keyword) + "&page=" + page;

  try {
    var resp = await Widget.http.get(url, { headers: buildHeaders() });
    var json = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
    var list = (json && (json.data || json.list || json.items)) || [];
    
    var out = [];
    for (var i = 0; i < list.length; i++) {
      out.push(formatArticleItem(list[i]));
    }
    return out;
  } catch (e) {
    return [];
  }
}

async function loadDetail(link) {
  var raw = String(link || "").trim();
  var id = raw.replace(/^haijiao:\/\/a\//, "").replace(/\/.*$/, "");
  if (!id) throw new Error("链接无效");

  var url = API_HOST + "/api/v1/topic/detail?id=" + id;
  
  try {
    var resp = await Widget.http.get(url, { headers: buildHeaders() });
    var json = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
    var a = (json && json.data) || json || {};

    var videoUrl = pick(a.videoUrl, a.video_url, a.playUrl, a.videoPath, a.url, "");
    var lines = [];
    if (videoUrl) {
      lines.push({
        id: id + "-1",
        type: "url",
        mediaType: "movie",
        title: "高清播放源",
        description: "直连播放",
        videoUrl: videoUrl,
        link: videoUrl
      });
    }

    var item = formatArticleItem(a);
    if (lines.length) {
      item.videoUrl = lines[0].videoUrl;
      item.childItems = lines;
    }
    return item;
  } catch (e) {
    throw new Error("获取详情失败");
  }
}

async function loadResource(params) {
  var link = (params && (params.link || params.url || params.id)) || "";
  var id = String(link).replace(/^haijiao:\/\/a\//, "").replace(/\/.*$/, "");
  if (!id) return [];

  try {
    var detail = await loadDetail(id);
    if (detail && detail.childItems && detail.childItems.length) {
      return detail.childItems.map(function(l) {
        return { name: l.title, description: l.description, url: l.videoUrl };
      });
    }
    if (detail && detail.videoUrl) {
      return [{ name: "默认播放源", description: "直连播放", url: detail.videoUrl }];
    }
    return [];
  } catch (e) {
    return [];
  }
}
