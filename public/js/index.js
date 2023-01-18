const data = { ok: true, message: "hellow world!", temp1: "", temp2: "" };
const obj = reactive(data);
const c1 = computed(() => obj.message + obj.temp1);
effect(() => {
  document.body.innerHTML = c1.value;
});
