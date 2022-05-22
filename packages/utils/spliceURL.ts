// 拼接URL 一般用于get请求
export const spliceURL = (obj: any): string => {
  if (obj.constructor !== Object) return '';

  let param = '';

  Object.keys(obj).map((key: string) => {
    if (!!!obj[key]) return;

    if (param === '') {
      param += `?${key}=${obj[key]}`;
    } else {
      param += `&${key}=${obj[key]}`;
    }
  });

  return param;
};
