const c = {
    ow_ceiling: 6000,
    aw_ceiling_param: 102000,
    employee_contrib: 0.2,
    employer_contrib: 0.17,
    cpf_annual_limit: 37740,
}

const tax_brackets = [20000,
    10000,
    10000,
    40000,
    40000,
    40000,
    40000,
    40000,
    40000,
    40000,
];
const tax_pct = [0, 2, 3.5, 7, 11.5, 15, 18, 19, 19.5, 20, 22];

function getPay(salary, age, additional_wage) {
    const cpf = CPF(salary, age, additional_wage);
    const remaining = salary - cpf.employee;
    const tax_paid = incomeTax(remaining, age);
    const take_home = remaining - tax_paid;
    const effective = 1- take_home/salary
    const effective_tax = tax_paid/remaining
    return {
        cpf: cpf,
        cpf_paid: cpf.employee,
        tax_paid: tax_paid,
        take_home: take_home,
        effective: effective,
        effective_tax: effective_tax,
    }
}

function incomeTax(salary, age) {
    let annual = salary * 12
    if (annual < tax_brackets[0]) {
        return 0;
    }

    let tax = 0;
    let cumulative = [];

    tax_brackets.reduce(function(a,b,i) { return cumulative[i] = a+b; },0);

    for (let i = 1; i < cumulative.length; i++) {
        if (annual < cumulative[i]) {
            var rem = annual - cumulative[i-1];
            tax += rem * tax_pct[i]/100;
            break;
        }
        tax += tax_brackets[i] * tax_pct[i]/100;
    }
    if (annual > cumulative[cumulative.length-1]) {
        tax += (annual - cumulative[cumulative.length-1])*tax_pct[tax_pct.length-1]/100
    }
    return tax/12.
}

function CPF(salary, age, additional_wage) {
    var amt;
    if (salary > c.ow_ceiling) {
        amt = c.ow_ceiling;
    } else {
        amt = salary;
    }

    const employee = amt*c.employee_contrib;
    const employer = amt*c.employer_contrib;

    var employee_aw, employer_aw;
    if (additional_wage === undefined) {
        additional_wage = 0;
        employee_aw = 0;
        employer_aw = 0;
    }


    const awc = c.aw_ceiling_param - amt*12;
    var aw_cpfed;
    if (additional_wage > awc) {
        // fill this in
        aw_cpfed = awc;
    } else {
        aw_cpfed = additional_wage;
    }
    employee_aw = aw_cpfed*c.employee_contrib;
    employer_aw = aw_cpfed*c.employer_contrib;

    const total_cpf_inflow = (employee + employer)*12 + employee_aw + employer_aw;
    if (total_cpf_inflow > c.cpf_annual_limit) {
        throw "something is wrong! CPF exceeded the annual limit!"
    }

    return {
        employee: employee,
        employer: employer,
        employee_aw: employee_aw,
        employer_aw: employer_aw,
        possible_voluntary: c.cpf_annual_limit - total_cpf_inflow,
        total_cpf_inflow: total_cpf_inflow/12,
    }
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
        let results = getPay(middle)
        let middle_res = results.take_home;
        if (approx_equal(salary, middle_res)) {
            return {
                total: middle,
                res: results,
            }
        }
        if (salary < middle_res) {
            stop = middle;
        } else {
            start = middle;
        }
        count++;
        if (count === 100000) { // prevent infinite looping
            break
        }
    }
}

function reverseTax(salary, age) {
    let annual = salary * 12
    if (annual < tax_brackets[0]) {
        return 0;
    }

    let tax = 0;
    let cumulative = [];

    tax_brackets.reduce(function(a,b,i) { return cumulative[i] = a + b*(1 - tax_pct[i]/100); },0);

    for (let i = 1; i < cumulative.length; i++) {
        if (annual < cumulative[i]) {
            var rem = annual - cumulative[i-1];
            tax += rem * tax_pct[i]/(100 - tax_pct[i]);
            break;
        }
        tax += tax_brackets[i] * tax_pct[i]/100;
    }
    if (annual > cumulative[cumulative.length-1]) {
        tax += (annual - cumulative[cumulative.length-1]) * tax_pct[tax_pct.length-1]/(100 - tax_pct[tax_pct.length-1]);
    }
    return tax/12;
}

function mustMake(salary, age){
 let postCPF = salary + reverseTax(salary, age);
 return postCPF + Math.min( postCPF*c.employee_contrib/(1-c.employee_contrib) , c.ow_ceiling*c.employee_contrib );
}
