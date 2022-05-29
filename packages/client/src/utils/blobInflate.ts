import Pako from 'pako';

export const blobInflate = (data: Blob) => {
  return new Promise((reslove, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = JSON.parse(
          Pako.inflate(e.target?.result as ArrayBuffer, { to: 'string' }),
        );

        reslove(result);
      } catch (err) {
        reject(err);
        console.error(err, '流报错');
      }
    };
    reader.readAsArrayBuffer(data);
  });
};
