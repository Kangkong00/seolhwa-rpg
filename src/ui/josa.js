// 받침에 따라 조사를 고름: josa('주먹밥', '을', '를') → '주먹밥을', josa('쥐고기', '을', '를') → '쥐고기를'
export function josa(word, withFinal, withoutFinal) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}
