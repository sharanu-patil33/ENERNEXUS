import numpy as np
import pandas as pd

# Number of normal operating samples
n = 500

# Grid voltage around the actual prototype value
voltage = np.random.normal(230, 2, n)

# Real bulb is approximately 6.5 W at 230 V
power = np.random.normal(6.5, 0.7, n)
power = np.clip(power, 4.0, 9.0)

# Keep current physically consistent with P ≈ V × I
current = power / voltage

# Normal ambient temperature
temperature = np.random.normal(28, 2, n)

df = pd.DataFrame({
    'voltage': voltage,
    'current': current,
    'power': power,
    'temperature': temperature
})

df.to_csv('baseline_data.csv', index=False)

print("✅ Generated normal baseline for ~6.5 W physical load")
print(f"   Voltage: ~230 V")
print(f"   Current: ~{power.mean()/voltage.mean():.3f} A")
print(f"   Power: ~{power.mean():.1f} W")
print("   Saved as baseline_data.csv")