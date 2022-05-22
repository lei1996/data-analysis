# Data Platform Server

Power by koa.js

## Appendix

koa router API: <https://github.com/koajs/router/blob/master/API.md>


--------------------------  2021-08-24  -----------------------------
服务端重构计划
在 services 里面load 初始化某个交易对. 这样需要监控交易某个交易对 直接new MainServices('xxx') 就可以了.
websocket 要用class包装起来.  services 里面初始化的时候会有几种情况.


使用rxjs 重构大部分代码，因为需要异步数据流。
大概思路:
    1. 一个定时器获取所有该交易所的合约，然后推入可观察对象。 后续的异步任务从这个数组来操作. (方便未来接入)

    1. 初始化获取历史k线，然后推入subject, 订阅这个subject的， 可以subscribe 多个 对应 1min 5min 15min，后面的通过k线合并
    2. 最主要的功能是push足够的k线之后，需要动态化的调整macd参数。而且需要较低cpu占用. 在操作者中调用自身的结果，然后做调参。


分层
    先推入数据，计算macd值，这里计算的值是公共的，有值推入到下一个class类。
    推入进来的时候开始计算最大最小值。
    初始化为0，0 第8根k线的时候开始动态计算最佳值，中途没有完成计算有新值推入进来，舍弃。
    每个子任务 延迟 1.5秒推入。
    这里用的数组是外面那个最大的数组，240 maxLength， 计算的时候需要 slice() 数组.