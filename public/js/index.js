const data = { ok: true, message: "hellow world!", temp1: "", temp2: "" };
const obj = reactive(data);
const c1 = computed(() => obj.message + obj.temp1);
let message;
function post() {
  let count = 0;
  return () =>
    new Promise((resolve, reject) => {
      if (count === 0) {
        setTimeout(resolve, 2000, 1);
        count++;
      } else {
        resolve(2);
      }
    });
}
const http = post();
watch(
  obj,
  async (newVal, oldVal, onInvalidate) => {
    let expire = false;
    onInvalidate(() => {
      expire = true;
    });
    const message = await http();
    if (expire) {
      return;
    }
    console.log(message);
  },
  {
    flush: "post",
  }
);
obj.message = 1;
setTimeout(() => {
  obj.message = 2;
}, 1000);
