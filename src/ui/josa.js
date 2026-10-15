// 받침에 따라 조사를 고름: josa('주먹밥', '을', '를') → '주먹밥을', josa('쥐고기', '을', '를') → '쥐고기를'
// '으로/로'는 ㄹ 받침도 '로'(마을로)
export function josa(word, withFinal, withoutFinal) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const final = code >= 0 && code <= 11171 ? code % 28 : 0;
  const rieul = final === 8;
  const useFinal = final !== 0 && !(withFinal === '으로' && rieul);
  return word + (useFinal ? withFinal : withoutFinal);
}
