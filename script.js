const c = {
  ow_monthly_ceiling: 6000,
  aw_ceiling_param: 102000,
  employee_contrib: 0.2,
  employer_contrib: 0.17,
  cpf_annual_limit: 37740,
  deduction_annual_limit: 80000,
};

// Includes 2024 changes: https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates
const tax_brackets = [
  20000, 10000, 10000, 40000, 40000, 40000, 40000, 40000, 40000, 40000, 180000,
  500000,
];
const tax_pct = [0, 2, 3.5, 7, 11.5, 15, 18, 19, 19.5, 20, 22, 23, 24];

function getPay({ salary, age, additional_wage, deductions } = {}) {
  // getPay assumes all inputs are on a yearly basis
  // salary: base pay
  // additional_wage: bonus
  const total_income = salary + additional_wage;
  const cpf = CPF(salary, age, additional_wage);
  const chargeable_income = Math.max(total_income - deductions - cpf.employee, 0);
  const tax = incomeTax(chargeable_income, age);
  const take_home = total_income - cpf.employee; // pre-tax
  const take_home_post_tax = take_home - tax;
  const effective = 1 - take_home_post_tax / total_income; // effective tax + CPF
  const effective_tax_total_income = tax / total_income;
  const effective_tax_chargeable_income = tax / chargeable_income;

  return {
    cpf: cpf,
    tax: tax,
    take_home: take_home,
    take_home_post_tax: take_home_post_tax,
    total_income: total_income,
    chargeable_income: chargeable_income,
    effective: effective,
    effective_tax_total_income: effective_tax_total_income,
    effective_tax_chargeable_income: effective_tax_chargeable_income,
    // Monthly does not consider taxes
    monthly_take_home: (salary - cpf.employee_ow) / 12,
    bonus_take_home: additional_wage - cpf.employee_aw,
  };
}

function incomeTax(annual, age) {
  /*
  annual: annual chargeable salary
  deductions: annual deductions
  */

  if (annual < tax_brackets[0]) {
    return 0;
  }

  let tax = 0;
  let cumulative = [];

  tax_brackets.reduce(function (a, b, i) {
    return (cumulative[i] = a + b);
  }, 0);

  for (let i = 1; i < cumulative.length; i++) {
    if (annual < cumulative[i]) {
      var rem = annual - cumulative[i - 1];
      tax += (rem * tax_pct[i]) / 100;
      break;
    }
    tax += (tax_brackets[i] * tax_pct[i]) / 100;
  }
  if (annual > cumulative[cumulative.length - 1]) {
    tax +=
      ((annual - cumulative[cumulative.length - 1]) *
        tax_pct[tax_pct.length - 1]) /
      100;
  }

  return tax;
}

function CPF(salary, age, additional_wage) {
  /*
  salary: annual salary
  additional_wage: annual additional wage
  */
  let exceeded_ow_ceiling = false;
  let exceeded_aw_ceiling = false;

  // ow: ordinary wage (base pay)
  // aw: additional wage (bonus)
  let cpfable_ow;
  const ow_ceiling = c.ow_monthly_ceiling * 12;
  if (salary > ow_ceiling) {
    cpfable_ow = ow_ceiling;
    exceeded_ow_ceiling = true;
  } else {
    cpfable_ow = salary;
  }

  const employee_ow = cpfable_ow * c.employee_contrib;
  const employer_ow = cpfable_ow * c.employer_contrib;

  if (additional_wage === undefined) {
    additional_wage = 0;
  }

  const aw_ceiling = c.aw_ceiling_param - cpfable_ow;
  var cpfable_aw;
  if (additional_wage > aw_ceiling) {
    cpfable_aw = aw_ceiling;
    exceeded_aw_ceiling = true;
  } else {
    cpfable_aw = additional_wage;
  }
  const employee_aw = cpfable_aw * c.employee_contrib;
  const employer_aw = cpfable_aw * c.employer_contrib;

  const employee = employee_ow + employee_aw;
  const employer = employer_ow + employer_aw;
  const total_cpf_inflow = employee + employer;
  if (total_cpf_inflow > c.cpf_annual_limit) {
    throw "something is wrong! CPF exceeded the annual limit!";
  }
  
  let explanation = "";
  if (!exceeded_ow_ceiling && !exceeded_aw_ceiling) {
    explanation += "Your salary and bonus are subject to 20% CPF"
  } else {
    const salary_amount = exceeded_ow_ceiling ? `\$${ow_ceiling}` : "all";
    const bonus_amount = exceeded_aw_ceiling ? `\$${aw_ceiling}` : "all";
    explanation += `${salary_amount} of your salary and ${bonus_amount} of your bonus are subject to 20% CPF`;
  }

  return {
    employee: employee,
    employer: employer,
    employee_ow: employee_ow,
    employer_ow: employer_ow,
    employee_aw: employee_aw,
    employer_aw: employer_aw,
    possible_voluntary: c.cpf_annual_limit - total_cpf_inflow,
    total_cpf_inflow: total_cpf_inflow,
    explanation: explanation,
  };
}

function approx_equal(n1, n2) {
  if (n1 - n2 < 0.01 && n1 - n2 > -0.01) {
    return true;
  } else {
    return false;
  }
}

// binary search, not being used, using the mustMake function instead
function getPayReversed(salary) {
  salary = parseFloat(salary);
  let start = salary;
  let stop = salary * 1.3;
  let middle;

  let count = 0;
  while (true) {
    middle = start + (stop - start) / 2;
    let results = getPay(middle);
    let middle_res = results.take_home;
    if (approx_equal(salary, middle_res)) {
      return {
        total: middle,
        res: results,
      };
    }
    if (salary < middle_res) {
      stop = middle;
    } else {
      start = middle;
    }
    count++;
    if (count === 100000) {
      // prevent infinite looping
      break;
    }
  }
}

function reverseTax(salary, age) {
  let annual = salary * 12;
  if (annual < tax_brackets[0]) {
    return 0;
  }

  let tax = 0;
  let cumulative = [];

  tax_brackets.reduce(function (a, b, i) {
    return (cumulative[i] = a + b * (1 - tax_pct[i] / 100));
  }, 0);

  for (let i = 1; i < cumulative.length; i++) {
    if (annual < cumulative[i]) {
      var rem = annual - cumulative[i - 1];
      tax += (rem * tax_pct[i]) / (100 - tax_pct[i]);
      break;
    }
    tax += (tax_brackets[i] * tax_pct[i]) / 100;
  }
  if (annual > cumulative[cumulative.length - 1]) {
    tax +=
      ((annual - cumulative[cumulative.length - 1]) *
        tax_pct[tax_pct.length - 1]) /
      (100 - tax_pct[tax_pct.length - 1]);
  }
  return tax / 12;
}

function mustMake(salary, age) {
  let postCPF = salary + reverseTax(salary, age);
  return (
    postCPF +
    Math.min(
      (postCPF * c.employee_contrib) / (1 - c.employee_contrib),
      c.ow_monthly_ceiling * c.employee_contrib
    )
  );
}
