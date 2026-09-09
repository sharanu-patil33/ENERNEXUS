import numpy as np
import pandas as pd

n = 500

voltage = np.random.normal(230, 3, n)
current = np.random.normal(2.2, 0.4, n)
power = voltage * current  # 🔴 calculated the same way the simulator does it
temperature = np.random.normal(28, 2, n)

df = pd.DataFrame({
    'voltage': voltage,
    'current': current,
    'power': power,
    'temperature': temperature
})

df.to_csv('baseline_data.csv', index=False)
print(f"✅ Generated {n} baseline readings -> baseline_data.csv")