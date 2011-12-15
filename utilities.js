/**
 * @author QLeelulu@gmail.com
 * @blog http://qleelulu.cnblogs.com
 */
 

/**
 * 格式化字符串 from tbra
 * eg:
 * 	formatText('{0}天有{1}个小时', [1, 24]) 
 *  or
 *  formatText('{{day}}天有{{hour}}个小时', {day:1, hour:24}}
 * @param {Object} msg
 * @param {Object} values
 */
function formatText(msg, values, filter) {
    var pattern = /\{\{([\w\s\.\(\)"',-\[\]]+)?\}\}/g;
    return msg.replace(pattern, function(match, key) {
    	var value = values[key] || eval('(values.' +key+')');
        return (typeof o == "function") ? filter(value, key) : value;
    });	
};

// 让所有字符串拥有模板格式化
String.prototype.format = function(data) {
	return formatText(this, data);
};

/************
 * 并行执行，并确认最终回调
 * var combo = new Combo(function(){
 *      console.log('finished');
 * });
 * combo.add();
 * db.find(function(){
 *      combo.finishOne();
 * });
 */
function Combo(callback) {
  this.callback = callback;
  this.items = 0;
}

Combo.prototype = {
  add: function () {
    this.items++;
  },
  finishOne: function () {
    this.items--;
    this.check();
  },
  check: function(){
      if (this.items == 0) {
        this.callback.apply(this);
      }
  }
};
global.Combo = Combo;


exports.makeSlug = function(str){
    str = (str || '').toLowerCase().trim();
    return str.replace(/\s/g, '-')
              .replace(/[\"\'\/]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '');
};
