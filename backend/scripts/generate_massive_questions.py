"""Generate massive questions (10,000 total: 500 per level per category) as CSV and seed MongoDB."""

import csv
import io
import json
import os
import random
import sys
from datetime import datetime

# Set up path to import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings
from app.db.connection import connect_mongodb
from app.db.indexes import ensure_indexes
from app.repositories.question_repository import QuestionRepository

CATEGORIES = ["numerical", "verbal", "reasoning", "advanced_quant", "advanced_coding"]
LEVELS = [1, 2, 3, 4]  # 1: Basic, 2: Intermediate, 3: Advanced, 4: Expert
QUESTIONS_PER_LEVEL = 500

COMPANIES = ["TCS", "Infosys", "Wipro", "Cognizant", "Capgemini", "Accenture", "Microsoft", "Google", "Amazon", "Tech Mahindra"]

def generate_numerical(level, q_index):
    """Generate a numerical question."""
    comp = random.choice(COMPANIES)
    
    if level == 1:
        # Basic: Simple Interest, Percentages, Averages, Profit/Loss
        pattern = q_index % 5
        if pattern == 0:
            # Simple Interest
            p = random.randint(10, 100) * 100
            r = random.randint(5, 15)
            t = random.randint(1, 5)
            si = (p * r * t) / 100
            q = f"Find the simple interest on Rs.{p} at {r}% per annum for {t} years."
            ans = f"Rs.{int(si)}" if si.is_integer() else f"Rs.{si:.1f}"
            opts = [ans, f"Rs.{int(si + 50)}", f"Rs.{int(si - 30)}", f"Rs.{int(si * 1.1)}"]
            exp = f"Simple Interest (SI) = (P * R * T) / 100 = ({p} * {r} * {t}) / 100 = Rs.{si}."
            topic = "Simple Interest"
        elif pattern == 1:
            # Percentage Increase
            initial = random.randint(100, 500) * 100
            inc = random.choice([5, 10, 15, 20, 25])
            final = int(initial * (1 + inc/100))
            q = f"A salary increases from Rs.{initial} to Rs.{final}. What is the percentage increase?"
            ans = f"{inc}%"
            opts = [ans, f"{inc + 5}%", f"{inc - 2}%", f"{inc * 1.2:.0f}%"]
            exp = f"Percentage Increase = ((Final - Initial) / Initial) * 100 = (({final} - {initial}) / {initial}) * 100 = {inc}%."
            topic = "Percentages"
        elif pattern == 2:
            # Profit Percentage
            cp = random.randint(10, 100) * 10
            profit_pct = random.choice([10, 12, 15, 20, 25])
            sp = int(cp * (1 + profit_pct/100))
            q = f"A shopkeeper buys a watch for Rs.{cp} and sells it for Rs.{sp}. What is his profit percentage?"
            ans = f"{profit_pct}%"
            opts = [ans, f"{profit_pct + 3}%", f"{profit_pct - 5}%", f"{profit_pct + 10}%"]
            exp = f"Profit = Selling Price (SP) - Cost Price (CP) = {sp} - {cp} = Rs.{sp - cp}. Profit % = (Profit / CP) * 100 = ({sp - cp} / {cp}) * 100 = {profit_pct}%."
            topic = "Profit & Loss"
        elif pattern == 3:
            # Averages
            count = random.randint(4, 8)
            avg = random.randint(20, 50)
            total = count * avg
            removed = random.choice([10, 15, 20, 25, 30, 40])
            new_total = total - removed
            new_avg = new_total / (count - 1)
            q = f"The average of {count} numbers is {avg}. If one number {removed} is removed, what is the average of the remaining numbers?"
            ans = f"{new_avg:.2f}" if not new_avg.is_integer() else f"{int(new_avg)}"
            opts = [ans, f"{new_avg + 2:.2f}" if not new_avg.is_integer() else f"{int(new_avg + 2)}", f"{new_avg - 1:.2f}" if not new_avg.is_integer() else f"{int(new_avg - 1)}", f"{new_avg * 1.1:.2f}"]
            exp = f"Total sum of {count} numbers = {count} * {avg} = {total}. After removing {removed}, new sum = {new_total}. New average = {new_total} / {count - 1} = {ans}."
            topic = "Averages"
        else:
            # Ratios
            ratio_a = random.randint(2, 5)
            ratio_b = random.randint(3, 7)
            while ratio_a == ratio_b:
                ratio_b = random.randint(3, 7)
            multiplier = random.randint(3, 10)
            boys = ratio_a * multiplier
            girls = ratio_b * multiplier
            total = boys + girls
            q = f"The ratio of boys to girls in a class is {ratio_a}:{ratio_b}. If there are {boys} boys, how many total students are in the class?"
            ans = str(total)
            opts = [ans, str(total + 5), str(total - 4), str(boys * 2)]
            exp = f"Boys : Girls = {ratio_a} : {ratio_b}. Since boys = {boys}, 1 part = {boys} / {ratio_a} = {multiplier}. Total parts = {ratio_a} + {ratio_b} = {ratio_a + ratio_b}. Total students = {ratio_a + ratio_b} * {multiplier} = {total}."
            topic = "Ratios"
            
    elif level == 2:
        # Intermediate: Compound Interest, Partnerships, Mixtures, Upstream/Downstream
        pattern = q_index % 4
        if pattern == 0:
            # Compound Interest (2 years)
            p = random.randint(5, 50) * 1000
            r = random.choice([5, 10, 20])
            amt = p * ((1 + r/100)**2)
            ci = amt - p
            q = f"Find the compound interest on Rs.{p} at {r}% per annum for 2 years, compounded annually."
            ans = f"Rs.{int(ci)}"
            opts = [ans, f"Rs.{int(ci + 100)}", f"Rs.{int(ci - 150)}", f"Rs.{int(p * r * 2 / 100)}"]
            exp = f"Amount = P * (1 + R/100)^2 = {p} * (1 + {r}/100)^2 = Rs.{int(amt)}. CI = Amount - P = {int(amt)} - {p} = Rs.{int(ci)}."
            topic = "Compound Interest"
        elif pattern == 1:
            # Partnerships
            a_inv = random.randint(2, 8) * 1000
            b_inv = random.randint(3, 10) * 1000
            tot_profit = (a_inv + b_inv) // 10
            a_share = int((a_inv / (a_inv + b_inv)) * tot_profit)
            q = f"A and B enter into a partnership investing Rs.{a_inv} and Rs.{b_inv} respectively. If the total profit at the end of the year is Rs.{tot_profit}, what is A's share?"
            ans = f"Rs.{a_share}"
            opts = [ans, f"Rs.{a_share + 100}", f"Rs.{tot_profit - a_share}", f"Rs.{a_share - 50}"]
            exp = f"Investment ratio A : B = {a_inv} : {b_inv}. A's share = (A's investment / Total investment) * Total profit = ({a_inv} / {a_inv + b_inv}) * {tot_profit} = Rs.{a_share}."
            topic = "Partnerships"
        elif pattern == 2:
            # Mixtures
            tot_mix = random.choice([30, 40, 50, 60, 80])
            milk_ratio = 3
            water_ratio = 2
            milk = int((milk_ratio / 5) * tot_mix)
            water = int((water_ratio / 5) * tot_mix)
            water_to_add = random.choice([10, 15, 20, 30])
            new_water = water + water_to_add
            # Find new ratio simplified
            import math
            g = math.gcd(milk, new_water)
            new_ratio_a = milk // g
            new_ratio_b = new_water // g
            q = f"A mixture of {tot_mix} liters contains milk and water in the ratio {milk_ratio}:{water_ratio}. If {water_to_add} liters of water is added to the mixture, what is the new ratio of milk to water?"
            ans = f"{new_ratio_a}:{new_ratio_b}"
            opts = [ans, f"{new_ratio_b}:{new_ratio_a}", f"{new_ratio_a + 1}:{new_ratio_b}", f"3:4"]
            exp = f"Initial Milk = {milk}L, Water = {water}L. After adding {water_to_add}L of water, new Water = {new_water}L. New ratio = {milk} : {new_water} = {new_ratio_a} : {new_ratio_b}."
            topic = "Mixtures"
        else:
            # Boat Speed
            b_speed = random.randint(10, 25)
            s_speed = random.randint(2, 6)
            dist = (b_speed - s_speed) * random.randint(2, 4)
            time_up = dist / (b_speed - s_speed)
            q = f"A boat speed in still water is {b_speed} km/h and the stream speed is {s_speed} km/h. How long (in hours) will it take to travel {dist} km upstream?"
            ans = f"{int(time_up)} hours" if time_up.is_integer() else f"{time_up:.1f} hours"
            opts = [ans, f"{int(time_up + 1)} hours", f"{dist / (b_speed + s_speed):.1f} hours", f"3 hours"]
            exp = f"Upstream speed = Boat speed - Stream speed = {b_speed} - {s_speed} = {b_speed - s_speed} km/h. Time taken = Distance / Upstream speed = {dist} / {b_speed - s_speed} = {time_up} hours."
            topic = "Boats & Streams"
            
    elif level == 3:
        # Advanced: Time and Distance, Pipes and Cistern leaks, Complex Age Relations
        pattern = q_index % 3
        if pattern == 0:
            # Pipes with Leak
            fill_time = random.randint(3, 6)
            leak_time = random.randint(8, 15)
            combined_time = (fill_time * leak_time) / (leak_time - fill_time)
            q = f"An inlet pipe can fill a tank in {fill_time} hours. Due to a leak at the bottom, it takes longer to fill. If the leak can completely empty a full tank in {leak_time} hours, how long (in hours) will it take to fill the empty tank with the inlet open?"
            ans = f"{combined_time:.1f}" if not combined_time.is_integer() else f"{int(combined_time)}"
            opts = [ans, f"{combined_time + 1.5:.1f}", f"{combined_time - 1:.1f}", f"{fill_time + leak_time}"]
            exp = f"Inlet rate = 1/{fill_time}, Leak rate = -1/{leak_time}. Combined rate = 1/{fill_time} - 1/{leak_time} = ({leak_time} - {fill_time}) / {fill_time * leak_time}. Time = {fill_time * leak_time} / ({leak_time} - {fill_time}) = {combined_time:.2f} hours."
            topic = "Pipes & Cisterns"
        elif pattern == 1:
            # Train crossing platform
            t_len = random.randint(10, 30) * 10
            speed_kmh = random.choice([36, 54, 72, 90])
            speed_ms = speed_kmh * 5 / 18
            plat_len = random.randint(15, 40) * 10
            cross_time = (t_len + plat_len) / speed_ms
            q = f"A train of length {t_len} meters is running at a speed of {speed_kmh} km/h. How long (in seconds) will it take to cross a platform of length {plat_len} meters?"
            ans = f"{int(cross_time)} seconds" if cross_time.is_integer() else f"{cross_time:.1f} seconds"
            opts = [ans, f"{int(cross_time + 5)} seconds", f"{int(cross_time - 3)} seconds", f"{t_len / speed_ms:.1f} seconds"]
            exp = f"Speed in m/s = {speed_kmh} * 5/18 = {speed_ms} m/s. Total distance = Train length + Platform length = {t_len} + {plat_len} = {t_len + plat_len}m. Time = Distance / Speed = {t_len + plat_len} / {speed_ms} = {cross_time} seconds."
            topic = "Trains & Speed"
        else:
            # Complex Age Relations
            f_ratio = random.randint(3, 5)
            years_diff = random.choice([5, 10, 15])
            # Let son age be s, father age be f. f = f_ratio * s
            # In years_diff years, f + years_diff = next_ratio * (s + years_diff)
            # We solve for s. Let's make it direct:
            s_age = random.randint(8, 20)
            f_age = f_ratio * s_age
            next_ratio = (f_age + years_diff) / (s_age + years_diff)
            q = f"The ratio of a father's age to his son's age is currently {f_ratio}:1. In {years_diff} years, the father will be {next_ratio:.1f} times as old as his son. What is the current age of the father?" if not next_ratio.is_integer() else f"The ratio of a father's age to his son's age is currently {f_ratio}:1. In {years_diff} years, the father will be {int(next_ratio)} times as old as his son. What is the current age of the father?"
            ans = f"{f_age} years"
            opts = [ans, f"{f_age + 5} years", f"{f_age - 5} years", f"{s_age * 4} years"]
            exp = f"Let son's age be x, father's be {f_ratio}x. In {years_diff} years: {f_ratio}x + {years_diff} = {next_ratio:.1f}(x + {years_diff}). Solving this gives son's age = {s_age} and father's age = {f_age}."
            topic = "Age Problems"
            
    else:
        # Expert: Logarithms, Advanced Probability, Remainders
        pattern = q_index % 3
        if pattern == 0:
            # Logarithms base change
            val = random.choice([8, 16, 32, 64])
            power = int(random.choice([3, 4, 5]))
            log_ans = power
            q = f"If log_2(x) + log_4(x) = {log_ans * 1.5:.1f}, find the value of x." if not (log_ans * 1.5).is_integer() else f"If log_2(x) + log_4(x) = {int(log_ans * 1.5)}, find the value of x."
            x_val = 2**power
            ans = str(x_val)
            opts = [ans, str(x_val * 2), str(x_val // 2), "8"]
            exp = f"Change base to 2: log_2(x) + log_2(x)/2 = 1.5 * log_2(x) = {log_ans * 1.5:.1f} => log_2(x) = {power} => x = 2^{power} = {x_val}."
            topic = "Logarithms"
        elif pattern == 1:
            # Remainders (Fermat's / Chinese remainder)
            divisor = random.choice([7, 11, 13])
            pow_val = divisor - 1
            mult = random.randint(10, 40)
            tot_pow = (pow_val * mult) + 1
            base = random.randint(2, 5)
            rem = (base ** 1) % divisor
            q = f"Find the remainder when {base}^{tot_pow} is divided by {divisor}."
            ans = str(rem)
            opts = [ans, str((rem + 1) % divisor), str((rem - 1) % divisor), "1"]
            exp = f"By Fermat's Little Theorem, since {divisor} is prime, {base}^{pow_val} ≡ 1 (mod {divisor}). Therefore, {base}^{tot_pow} = ({base}^{pow_val})^{mult} * {base}^1 ≡ 1^{mult} * {base} ≡ {rem} (mod {divisor})."
            topic = "Number Theory"
        else:
            # Advanced replacement mixture
            cap = random.choice([40, 50, 60])
            repl = random.choice([4, 5, 10])
            cycles = 2
            ratio = ((cap - repl) / cap) ** cycles
            milk_left = cap * ratio
            q = f"A container contains {cap} liters of pure milk. {repl} liters of milk is replaced with water. This process is repeated one more time. What is the remaining quantity of pure milk in the container?"
            ans = f"{milk_left:.2f} liters"
            opts = [ans, f"{cap - repl * 2} liters", f"{milk_left - 2:.2f} liters", f"{cap * 0.8:.2f} liters"]
            exp = f"Quantity of milk left = Capacity * (1 - replaced/Capacity)^cycles = {cap} * (1 - {repl}/{cap})^2 = {cap} * ({cap - repl}/{cap})^2 = {milk_left:.2f} liters."
            topic = "Advanced Mixtures"

    # Ensure options are unique and shuffle them
    opts = list(set(opts))
    while len(opts) < 4:
        opts.append(f"Rs.{random.randint(100, 1000)}" if "$" in ans or "Rs" in ans else str(random.randint(5, 100)))
    random.shuffle(opts)
    
    # Map answers to options
    return {
        "question": q,
        "optionA": opts[0],
        "optionB": opts[1],
        "optionC": opts[2],
        "optionD": opts[3],
        "correctAnswer": ans,
        "explanation": exp,
        "category": "numerical",
        "level": level,
        "topic": comp,
        "difficulty": "Easy" if level == 1 else "Medium" if level == 2 else "Hard" if level == 3 else "Expert"
    }

def generate_verbal(level, q_index):
    """Generate a verbal question."""
    comp = random.choice(COMPANIES)
    
    # Vocabulary resources
    nouns = ["analyst", "engineer", "designer", "director", "manager", "auditor", "consultant", "developer"]
    nouns_plural = ["analysts", "engineers", "designers", "directors", "managers", "auditors", "consultants", "developers"]
    verbs_singular = ["has", "is", "was", "writes", "creates", "manages", "leads"]
    verbs_plural = ["have", "are", "were", "write", "create", "manage", "lead"]
    
    if level == 1:
        # Basic: Subject-Verb agreement, Synonyms, Antonyms, prepositions
        pattern = q_index % 4
        if pattern == 0:
            noun = random.choice(nouns_plural)
            correct_v = "has"
            wrong_v = "have"
            q = f"Spot the error: Choose the segment containing a grammatical error:\n'Each of the {noun} {wrong_v} completed the daily training session.'"
            ans = wrong_v
            opts = ["Each of the", noun, wrong_v, "completed the"]
            exp = f"The subject 'Each' is singular, so it requires the singular verb '{correct_v}' instead of the plural '{wrong_v}'."
            topic = "Subject-Verb Agreement"
        elif pattern == 1:
            words = [("concise", "brief"), ("abundant", "plentiful"), ("diligent", "hardworking"), ("trivial", "unimportant"), ("candid", "honest")]
            w, syn = words[q_index % len(words)]
            q = f"Choose the word that is most similar in meaning (synonym) to the word: '{w.upper()}'"
            ans = syn.capitalize()
            opts = [ans, "Complicated", "Hidden", "Unclear"]
            exp = f"'{w.capitalize()}' means representing details in a short, clear way, which matches '{syn.capitalize()}'."
            topic = "Synonyms"
        elif pattern == 2:
            words = [("obstinate", "flexible"), ("frugal", "extravagant"), ("allure", "repel"), ("amplify", "decrease"), ("dull", "vibrant")]
            w, ant = words[q_index % len(words)]
            q = f"Choose the word that is most opposite in meaning (antonym) to the word: '{w.upper()}'"
            ans = ant.capitalize()
            opts = [ans, "Stubborn", "Rigid", "Greedy"]
            exp = f"'{w.capitalize()}' represents a fixed, rigid state. The opposite of this is '{ant.capitalize()}'."
            topic = "Antonyms"
        else:
            q = f"Fill in the blank: 'The senior architect congratulated the developer _____ solving the database deadlock.'"
            ans = "on"
            opts = ["on", "for", "at", "about"]
            exp = f"The verb 'congratulate' takes the preposition 'on' (congratulate someone on doing something)."
            topic = "Prepositions"
            
    elif level == 2:
        # Intermediate: Sentence correction, Spelling, Idioms
        pattern = q_index % 3
        if pattern == 0:
            q = f"Sentence Correction: Choose the best replacement for the underlined phrase:\n'Being a stormy night, we decided to postpone the client demo.'"
            ans = "It being a stormy night"
            opts = [ans, "Being a stormy night", "Because of stormy night", "As the night was of storm"]
            exp = f"The original sentence has a dangling modifier. 'Being a stormy night' improperly modifies 'we'. Adding 'It' corrects this."
            topic = "Modifiers"
        elif pattern == 1:
            spellings = [("Accommodate", ["Accomodate", "Acomodate", "Acommodate"]), 
                         ("Occurrence", ["Occurence", "Ocurrence", "Occurrance"]),
                         ("Maintenance", ["Maintainance", "Maintanence", "Maintenence"])]
            corr, wrongs = spellings[q_index % len(spellings)]
            q = f"Spelling Test: Select the option with the correct spelling."
            ans = corr
            opts = [corr] + wrongs
            exp = f"The correct dictionary spelling is '{corr}'."
            topic = "Spelling"
        else:
            idioms = [("burn the midnight oil", "work late into the night"),
                      ("a blessing in disguise", "a good thing that seemed bad at first"),
                      ("take it with a grain of salt", "listen with skepticism")]
            idm, meaning = idioms[q_index % len(idioms)]
            q = f"Idioms: Choose the option that best describes the meaning of the phrase: 'To {idm}'"
            ans = meaning.capitalize()
            opts = [ans, "To spend money quickly", "To cause an argument", "To agree completely"]
            exp = f"The idiom '{idm}' refers to '{meaning}'."
            topic = "Idioms"
            
    elif level == 3:
        # Advanced: Active/Passive, Analogies, Direct/Indirect
        pattern = q_index % 2
        if pattern == 0:
            q = f"Active to Passive: Convert the sentence:\n'The technical lead reviewed the security patch yesterday.'"
            ans = "The security patch was reviewed by the technical lead yesterday."
            opts = [ans, 
                    "The security patch is reviewed by the technical lead yesterday.", 
                    "The security patch was being reviewed by the technical lead.", 
                    "The technical lead was reviewed by the security patch yesterday."]
            exp = f"In the past active voice 'reviewed', the passive version is formed using 'was/were reviewed'."
            topic = "Active & Passive"
        else:
            analogies = [("ANACHRONISM : TIME", "Solecism : Language"),
                         ("EPHEMERAL : DURATION", "Flaccid : Strength"),
                         ("OBSEQUIOUS : SERVILITY", "Pugnacious : Aggression")]
            pair, corr_pair = analogies[q_index % len(analogies)]
            q = f"Analogies: Select the pair that represents the same relationship as: '{pair}'"
            ans = corr_pair
            opts = [ans, "Clock : Hour", "Brief : Length", "Truth : Lie"]
            exp = f"An anachronism is an error in time; a solecism is an error in language. The relationship is type-to-context error."
            topic = "Analogies"
            
    else:
        # Expert: Sentence completion with double blanks, critical comprehension
        words_double = [("tortuous .. bewilder", ["lucid .. educate", "straightforward .. confuse", "expressive .. delight"]),
                        ("capricious .. unpredictable", ["stable .. variable", "erratic .. reliable", "constant .. volatile"]),
                        ("tendentious .. bias", ["impartial .. neutrality", "scholarly .. ignorance", "dogmatic .. openmindedness"])]
        corr, wrongs = words_double[q_index % len(words_double)]
        blank_a, blank_b = corr.split(" .. ")
        q = f"Sentence Completion: Choose the pair of words that best fits the blanks:\n'The executive's ______ decisions, driven by emotion rather than logic, created a highly ______ work environment.'"
        ans = f"{blank_a} / {blank_b}"
        opts = [ans] + [f"{w.split(' .. ')[0]} / {w.split(' .. ')[1]}" for w in wrongs]
        exp = f"An executive making decisions based on emotion is 'capricious' (or tendentious/tortuous), which makes the environment 'unpredictable' (or biased/bewildering)."
        topic = "Double Blanks"

    opts = list(set(opts))
    while len(opts) < 4:
        opts.append("Option " + str(random.randint(1, 100)))
    random.shuffle(opts)
    
    return {
        "question": q,
        "optionA": opts[0],
        "optionB": opts[1],
        "optionC": opts[2],
        "optionD": opts[3],
        "correctAnswer": ans,
        "explanation": exp,
        "category": "verbal",
        "level": level,
        "topic": comp,
        "difficulty": "Easy" if level == 1 else "Medium" if level == 2 else "Hard" if level == 3 else "Expert"
    }

def generate_reasoning(level, q_index):
    """Generate a reasoning question."""
    comp = random.choice(COMPANIES)
    
    if level == 1:
        # Basic: Coding-decoding, Series, Blood Relations
        pattern = q_index % 3
        if pattern == 0:
            # Coding-decoding
            sh = random.randint(1, 3)
            q = f"If APPLE is coded as {chr(65+sh)}{chr(80+sh)}{chr(80+sh)}{chr(76+sh)}{chr(69+sh)} using a simple letter shift, how is ORANGE coded in the same pattern?"
            ans = "".join(chr(ord(c) + sh) for c in "ORANGE")
            opts = [ans, "PSGOHF", "NQDMFD", "QTBPHF"]
            exp = f"Each letter is shifted forward in the alphabet by {sh} positions."
            topic = "Coding-Decoding"
        elif pattern == 1:
            # Series
            start = random.randint(2, 5)
            step = random.randint(3, 8)
            series = [start + i*step for i in range(5)]
            next_val = start + 5*step
            q = f"Number Series: Find the missing term in the sequence: {', '.join(map(str, series))}, ?"
            ans = str(next_val)
            opts = [ans, str(next_val + step), str(next_val - 2), str(next_val + 10)]
            exp = f"The differences between consecutive terms are constant (+{step}). The next term is {series[-1]} + {step} = {next_val}."
            topic = "Number Series"
        else:
            # Blood relations
            q = f"Pointing to a photograph, Rohan says, 'He is the son of the only son of my grandfather.' How is the person in the photo related to Rohan?"
            ans = "Brother"
            opts = ["Brother", "Cousin", "Uncle", "Father"]
            exp = "Rohan's grandfather's only son is Rohan's father. The son of Rohan's father is Rohan's brother."
            topic = "Blood Relations"
            
    elif level == 2:
        # Intermediate: Seating arrangements, direction sense, clocks
        pattern = q_index % 3
        if pattern == 0:
            # Clocks
            h = random.choice([2, 3, 4, 8, 9, 10])
            m = random.choice([20, 30, 40])
            ang = abs(30*h - 5.5*m)
            if ang > 180:
                ang = 360 - ang
            q = f"Clocks: Find the angle (in degrees) between the hour hand and the minute hand of a clock at {h}:{m}."
            ans = f"{ang:.1f}°" if not ang.is_integer() else f"{int(ang)}°"
            opts = [ans, f"{ang + 10:.0f}°", f"{ang - 15:.0f}°", "90°"]
            exp = f"Angle formula = |30H - 5.5M| = |30({h}) - 5.5({m})| = {ang}°."
            topic = "Clocks"
        elif pattern == 1:
            # Direction sense
            east = random.randint(5, 15)
            north = random.randint(4, 12)
            west = east
            q = f"Direction Sense: A person walks {east} meters east, then turns left and walks {north} meters, then turns left and walks {west} meters. How far is he from his starting point?"
            ans = f"{north} meters"
            opts = [ans, f"{east} meters", f"{east + north} meters", "0 meters"]
            exp = f"The east and west movements cancel out, leaving the person exactly {north} meters north of the starting position."
            topic = "Directions"
        else:
            # Seating
            q = f"Seating Arrangement: A, B, C, and D are sitting in a row facing north. C sits immediately to the left of A. A sits immediately to the left of B. D sits to the right of B. Who is sitting at the leftmost end?"
            ans = "C"
            opts = ["A", "B", "C", "D"]
            exp = "The sitting order from left to right is C, A, B, D. Therefore, C is at the leftmost end."
            topic = "Seating Arrangement"
            
    elif level == 3:
        # Advanced: Syllogisms, Assertion/Reasoning, Complex Calendar
        pattern = q_index % 2
        if pattern == 0:
            q = f"Syllogisms: Identify the logical conclusion based on statements:\nStatements:\n1. All stars are planets.\n2. Some planets are moons.\n\nConclusions:\nI. Some moons are stars.\nII. Some planets are stars."
            ans = "Only conclusion II follows"
            opts = ["Only conclusion I follows", "Only conclusion II follows", "Both follow", "Neither follows"]
            exp = "Since all stars are planets, any star is a planet, which means some planets are stars (II follows). Moons and stars have no guaranteed intersection (I does not follow)."
            topic = "Syllogisms"
        else:
            q = f"Calendar: If January 1st of a non-leap year is a Sunday, what day of the week will January 1st of the next year be?"
            ans = "Monday"
            opts = ["Monday", "Tuesday", "Sunday", "Saturday"]
            exp = "A non-leap year has 365 days, which equals 52 weeks and 1 odd day. Therefore, the day shifts forward by 1, making it a Monday."
            topic = "Calendar"
            
    else:
        # Expert: Binary Logic, Cryptarithms, Advanced Input/Output
        q = f"Binary Logic: Three men A, B, and C are accused of a crime. One is a truth-teller, one is a liar, and one is an alternator (alternates truth and lies). They make statements:\nA: 'B committed the crime.'\nB: 'A is lying.'\nC: 'I did not commit the crime.'\nIf the criminal is the truth-teller, who committed the crime?"
        ans = "B"
        opts = ["A", "B", "C", "Cannot be determined"]
        exp = "Assuming B is the criminal and the truth-teller, C's statement must be true (C is alternator/liar). A's statement is true (matching B committing the crime). B is the liar (saying A is lying is false, which matches B being the liar). This holds consistently."
        topic = "Binary Logic"

    opts = list(set(opts))
    while len(opts) < 4:
        opts.append("Option " + str(random.randint(1, 100)))
    random.shuffle(opts)
    
    return {
        "question": q,
        "optionA": opts[0],
        "optionB": opts[1],
        "optionC": opts[2],
        "optionD": opts[3],
        "correctAnswer": ans,
        "explanation": exp,
        "category": "reasoning",
        "level": level,
        "topic": comp,
        "difficulty": "Easy" if level == 1 else "Medium" if level == 2 else "Hard" if level == 3 else "Expert"
    }

def generate_adv_quant(level, q_index):
    """Generate an advanced quant question."""
    comp = random.choice(COMPANIES)
    
    if level == 1:
        # Basic: Permutations, Probability, Algebra
        pattern = q_index % 3
        if pattern == 0:
            word = random.choice(["CODE", "PLAY", "WORK", "WORK", "MATH", "FLOW"])
            q = f"Permutations: In how many different ways can the letters of the word '{word}' be arranged?"
            ans = "24"
            opts = ["24", "12", "120", "6"]
            exp = f"The word '{word}' contains 4 distinct letters. The number of arrangements is 4! = 4 * 3 * 2 * 1 = 24."
            topic = "Permutations"
        elif pattern == 1:
            q = f"Probability: A single card is drawn from a standard deck of 52 cards. What is the probability that it is a King?"
            ans = "1/13"
            opts = ["1/13", "1/52", "1/4", "4/13"]
            exp = "A deck contains 4 Kings out of 52 cards. Probability = 4 / 52 = 1 / 13."
            topic = "Probability"
        else:
            q = f"Algebra: If 2x + 7 = 15, what is the value of x^2?"
            ans = "16"
            opts = ["16", "4", "9", "25"]
            exp = "2x = 15 - 7 => 2x = 8 => x = 4. Therefore, x^2 = 16."
            topic = "Algebra"
            
    elif level == 2:
        # Intermediate: Combinations, Mixtures, Geometry
        pattern = q_index % 3
        if pattern == 0:
            n = random.randint(5, 8)
            r = 2
            comb = (n * (n-1)) // 2
            q = f"Combinations: In a tournament, there are {n} teams. If every team plays every other team exactly once, how many total matches are played?"
            ans = str(comb)
            opts = [ans, str(comb + n), str(n * (n-1)), str(comb - 3)]
            exp = f"The number of matches is given by nC2 = {n}C2 = ({n} * {n-1}) / 2 = {comb}."
            topic = "Combinations"
        elif pattern == 1:
            q = f"Geometry: Find the area of a rectangle (in sq. meters) if its diagonal is 13m and its width is 5m."
            ans = "60"
            opts = ["60", "65", "120", "30"]
            exp = "Using Pythagoras: Length = sqrt(13^2 - 5^2) = sqrt(169 - 25) = sqrt(144) = 12m. Area = Length * Width = 12 * 5 = 60 sq. meters."
            topic = "Geometry"
        else:
            q = f"Percentages: A solution contains 10% alcohol. How many ml of pure alcohol must be added to 400ml of this solution to make it a 20% alcohol solution?"
            ans = "50 ml"
            opts = ["50 ml", "40 ml", "60 ml", "80 ml"]
            exp = "Initial alcohol = 40ml. Let x ml of alcohol be added. (40 + x) / (400 + x) = 0.20 => 40 + x = 80 + 0.2x => 0.8x = 40 => x = 50 ml."
            topic = "Mixtures"
            
    elif level == 3:
        # Advanced: Circular Permutations, Heights and Distances
        pattern = q_index % 2
        if pattern == 0:
            n = random.randint(4, 7)
            ans_val = 1
            for i in range(1, n):
                ans_val *= i
            q = f"Circular Permutations: In how many ways can {n} people sit around a circular table?"
            ans = str(ans_val)
            opts = [ans, str(ans_val * n), str(ans_val // 2), "120"]
            exp = f"For circular permutations, the number of ways to arrange n items is (n-1)! = ({n}-1)! = {ans_val}."
            topic = "Circular Arrangements"
        else:
            q = f"Trigonometry: From the top of a 50m high tower, the angle of depression of a car on the ground is 30°. How far (in meters) is the car from the base of the tower?"
            ans = "50√3"
            opts = ["50√3", "50", "100", "50/√3"]
            exp = "tan(30°) = Height / Distance => 1/√3 = 50 / Distance => Distance = 50√3 meters."
            topic = "Heights & Distances"
            
    else:
        # Expert: Complex probability, calculus integrations, coordinate geometry
        q = f"Advanced Coordinate Geometry: Find the equation of a line passing through the intersection of the lines x + y = 4 and 2x - y = 5, and perpendicular to the line 3x - y = 1."
        ans = "x + 3y = 12"
        opts = ["x + 3y = 12", "3x + y = 10", "x - 3y = 6", "x + 3y = 6"]
        exp = "The intersection point is (3, 1). The slope of the line 3x - y = 1 is 3. The perpendicular line's slope is -1/3. Equation: y - 1 = -1/3(x - 3) => 3y - 3 = -x + 3 => x + 3y = 6? Wait, let's recalculate: y - 1 = -1/3(x - 3) => 3y - 3 = -x + 3 => x + 3y = 6. Correct option is x + 3y = 6."
        ans = "x + 3y = 6"
        opts = ["x + 3y = 6", "x + 3y = 12", "3x + y = 10", "x - 3y = 6"]
        exp = "Intersection point is (3, 1). Perpendicular slope is -1/3. Equation: y - 1 = -1/3(x - 3) => 3y - 3 = -x + 3 => x + 3y = 6."
        topic = "Analytical Geometry"

    opts = list(set(opts))
    while len(opts) < 4:
        opts.append("Option " + str(random.randint(1, 100)))
    random.shuffle(opts)
    
    return {
        "question": q,
        "optionA": opts[0],
        "optionB": opts[1],
        "optionC": opts[2],
        "optionD": opts[3],
        "correctAnswer": ans,
        "explanation": exp,
        "category": "advanced_quant",
        "level": level,
        "topic": comp,
        "difficulty": "Easy" if level == 1 else "Medium" if level == 2 else "Hard" if level == 3 else "Expert"
    }

def generate_adv_coding(level, q_index):
    """Generate an advanced coding question."""
    comp = random.choice(COMPANIES)
    
    if level == 1:
        # Basic: Data structures, search time complexities, bitwise operations
        pattern = q_index % 3
        if pattern == 0:
            q = f"Bitwise: What is the decimal value of the bitwise operations expression: 12 & 10?"
            ans = "8"
            opts = ["8", "14", "4", "0"]
            exp = "12 in binary is 1100. 10 is 1010. 1100 & 1010 = 1000, which is 8 in decimal."
            topic = "Bitwise Operators"
        elif pattern == 1:
            q = f"Data Structures: Which of the following represents the time complexity of searching in a Hash Map in the average case?"
            ans = "O(1)"
            opts = ["O(1)", "O(log n)", "O(n)", "O(n log n)"]
            exp = "Hash maps allow key-based insertions and lookups in constant time O(1) in the average case."
            topic = "Complexity Analysis"
        else:
            q = f"Arrays: Given the array [2, 8, 4, 8, 5, 7], what is the second largest distinct element?"
            ans = "7"
            opts = ["7", "8", "5", "6"]
            exp = "The distinct sorted elements are [2, 4, 5, 7, 8]. The largest is 8, and the second largest is 7."
            topic = "Arrays"
            
    elif level == 2:
        # Intermediate: Tree traversals, recursion dry runs, stacks/queues
        pattern = q_index % 3
        if pattern == 0:
            val = random.randint(3, 6)
            # solve(x) = x + solve(x-1). solve(0) = 0
            res = (val * (val + 1)) // 2
            q = f"Recursion: What is the output of the recursive call solve({val}) for the code: int solve(int x) {{ return x == 0 ? 0 : x + solve(x - 1); }}?"
            ans = str(res)
            opts = [ans, str(res + 3), str(res - 1), str(val * 2)]
            exp = f"The function calculates the sum of integers from 1 to {val}: {res}."
            topic = "Recursion"
        elif pattern == 1:
            q = f"Tree Traversals: In which binary tree traversal are the nodes visited in the order: Left Subtree, Right Subtree, Root Node?"
            ans = "Post-order"
            opts = ["Post-order", "Pre-order", "In-order", "Level-order"]
            exp = "Post-order traversal visits the left node, right node, and then the root node."
            topic = "Tree traversals"
        else:
            q = f"Queues: Which data structure operates under the First In First Out (FIFO) protocol?"
            ans = "Queue"
            opts = ["Queue", "Stack", "Priority Queue", "BST"]
            exp = "A queue inserts items at the back and removes from the front, forming First In First Out (FIFO) behavior."
            topic = "Data Structures"
            
    elif level == 3:
        # Advanced: Dynamic programming, Heap heapify, Graph shortest path
        pattern = q_index % 2
        if pattern == 0:
            q = f"Graph Algorithms: Which algorithm should be used to find the shortest path from a single source vertex to all other vertices in a weighted graph with negative edge weights but no negative cycles?"
            ans = "Bellman-Ford Algorithm"
            opts = ["Bellman-Ford Algorithm", "Dijkstra's Algorithm", "Floyd-Warshall", "Kruskal's Algorithm"]
            exp = "Dijkstra's algorithm fails with negative weights. The Bellman-Ford algorithm supports negative weights in O(VE) time."
            topic = "Graph Algorithms"
        else:
            q = f"Heap: What is the time complexity of building a Binary Heap of size n from an unsorted array using the bottom-up heapify method?"
            ans = "O(n)"
            opts = ["O(n)", "O(n log n)", "O(log n)", "O(1)"]
            exp = "Building a heap bottom-up takes linear time O(n) because the work decreases exponentially as we go up the tree levels."
            topic = "Heaps"
            
    else:
        # Expert: All-pairs shortest paths, KMP string prefix calculations, DP complexities
        q = f"String Algorithms: What is the length of the longest proper prefix that is also a proper suffix (LPS) for the string 'ABABAB' in the Knuth-Morris-Pratt (KMP) prefix table?"
        ans = "4"
        opts = ["4", "2", "3", "5"]
        exp = "The proper prefixes of 'ABABAB' are ['A', 'AB', 'ABA', 'ABAB', 'ABABA']. The proper suffixes are ['B', 'AB', 'BAB', 'ABAB', 'BABAB']. The longest matching proper prefix/suffix is 'ABAB', which has length 4."
        topic = "KMP String Matching"

    opts = list(set(opts))
    while len(opts) < 4:
        opts.append("Option " + str(random.randint(1, 100)))
    random.shuffle(opts)
    
    return {
        "question": q,
        "optionA": opts[0],
        "optionB": opts[1],
        "optionC": opts[2],
        "optionD": opts[3],
        "correctAnswer": ans,
        "explanation": exp,
        "category": "advanced_coding",
        "level": level,
        "topic": comp,
        "difficulty": "Easy" if level == 1 else "Medium" if level == 2 else "Hard" if level == 3 else "Expert"
    }


def main():
    print("Generating massive questions bank...")
    
    # Target directory for CSVs
    csv_dir = os.path.join(settings.DATA_DIR, "csv")
    os.makedirs(csv_dir, exist_ok=True)
    
    headers = [
        "question", "optionA", "optionB", "optionC", "optionD",
        "correctAnswer", "explanation", "category", "level", "topic", "difficulty"
    ]
    
    all_questions = []
    
    for category in CATEGORIES:
        category_questions = []
        print(f"Generating questions for '{category}'...")
        
        for level in LEVELS:
            print(f"  Level {level}...")
            for i in range(QUESTIONS_PER_LEVEL):
                q_index = (level - 1) * QUESTIONS_PER_LEVEL + i
                
                if category == "numerical":
                    q = generate_numerical(level, q_index)
                elif category == "verbal":
                    q = generate_verbal(level, q_index)
                elif category == "reasoning":
                    q = generate_reasoning(level, q_index)
                elif category == "advanced_quant":
                    q = generate_adv_quant(level, q_index)
                else:  # advanced_coding
                    q = generate_adv_coding(level, q_index)
                
                category_questions.append(q)
                all_questions.append(q)
        
        # Save category CSV
        cat_file = os.path.join(csv_dir, f"{category}.csv")
        with open(cat_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(category_questions)
            
        print(f"Saved {len(category_questions)} questions to {cat_file}")
        
    # Save all questions CSV
    all_file = os.path.join(csv_dir, "all_questions.csv")
    with open(all_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(all_questions)
        
    print(f"Saved all {len(all_questions)} questions to {all_file}")
    
    # Connect and seed database
    print("\nConnecting to MongoDB Atlas...")
    connect_mongodb()
    ensure_indexes()
    
    print("Clearing existing questions in MongoDB...")
    QuestionRepository._col().delete_many({})
    
    print("Seeding new questions into MongoDB...")
    
    # Insert in batches of 1,000 to avoid packet limits
    batch_size = 1000
    for i in range(0, len(all_questions), batch_size):
        batch = all_questions[i:i + batch_size]
        payload = []
        for q in batch:
            payload.append({
                "question": q["question"],
                "options": [q["optionA"], q["optionB"], q["optionC"], q["optionD"]],
                "correctAnswer": q["correctAnswer"],
                "explanation": q["explanation"],
                "category": q["category"],
                "level": q["level"],
                "topic": q["topic"],
                "difficulty": q["difficulty"]
            })
        QuestionRepository.insert_many(payload)
        print(f"Inserted batch {i // batch_size + 1}/{len(all_questions) // batch_size} ({len(payload)} questions)")
        
    print(f"\nSeeding complete. Total questions in database: {QuestionRepository.count_all()}")

if __name__ == "__main__":
    main()
