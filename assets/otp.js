// Saisie du code : passage automatique d'une case à l'autre et collage d'un code complet.
(function () {
  var inputs = Array.prototype.slice.call(document.querySelectorAll('.otp-input'));
  if (!inputs.length) return;
  inputs[0].focus();
  inputs.forEach(function (input, i) {
    input.addEventListener('input', function () {
      var v = input.value.replace(/\D/g, '');
      if (v.length > 1) {
        // Code collé ou rempli automatiquement
        v.split('').slice(0, inputs.length - i).forEach(function (ch, k) { inputs[i + k].value = ch; });
        var next = Math.min(i + v.length, inputs.length - 1);
        inputs[next].focus();
      } else {
        input.value = v;
        if (v && i < inputs.length - 1) inputs[i + 1].focus();
      }
      if (inputs.every(function (x) { return x.value.length === 1; })) {
        document.getElementById('otp-form').requestSubmit();
      }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !input.value && i > 0) inputs[i - 1].focus();
    });
  });
})();
