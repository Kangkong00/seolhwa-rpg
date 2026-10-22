// 숫자 글자: 1,000이 넘으면 쉼표(docs/spec/feedback_1022.md 8). 소수는 반올림
export function formatNum(n) {
  return Math.round(n).toLocaleString('en-US');
}
